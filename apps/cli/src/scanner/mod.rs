use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::{collections::BTreeMap, fs, path::Path};

const PRUNED_DIRECTORIES: [&str; 4] = ["node_modules", "target", "vendor", ".git"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ManifestEvidence {
    pub path: String,
    pub kind: String,
    #[serde(rename = "languageId")]
    pub language_id: String,
    #[serde(rename = "runtimeId")]
    pub runtime_id: String,
    #[serde(rename = "packageManagerId", skip_serializing_if = "Option::is_none")]
    pub package_manager_id: Option<String>,
    #[serde(rename = "lockfileId", skip_serializing_if = "Option::is_none")]
    pub lockfile_id: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ScanResult {
    pub manifests: Vec<ManifestEvidence>,
    pub files: Vec<String>,
}

pub fn scan(root: &Path) -> Result<ScanResult> {
    if !root.is_dir() {
        bail!("project path is not a directory");
    }

    let mut pending = vec![root.to_path_buf()];
    let mut result = ScanResult::default();
    while let Some(directory) = pending.pop() {
        let entries = fs::read_dir(&directory)
            .with_context(|| format!("read directory {}", relative(root, &directory)))?;
        let mut children = Vec::new();
        for entry in entries {
            let entry = entry.with_context(|| {
                format!("read directory entry in {}", relative(root, &directory))
            })?;
            let file_type = entry.file_type().context("inspect directory entry")?;
            let path = entry.path();
            if file_type.is_dir() {
                if entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| PRUNED_DIRECTORIES.contains(&name))
                {
                    continue;
                }
                children.push(path);
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            let relative_path = relative(root, &path);
            result.files.push(relative_path.clone());
            if let Some(evidence) = detect_manifest(root, &path, &relative_path)? {
                result.manifests.push(evidence);
            }
        }
        children.sort();
        pending.extend(children.into_iter().rev());
    }
    result
        .manifests
        .sort_by(|left, right| left.path.cmp(&right.path));
    result.files.sort();
    Ok(result)
}

fn detect_manifest(
    root: &Path,
    path: &Path,
    relative_path: &str,
) -> Result<Option<ManifestEvidence>> {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return Ok(None);
    };
    let (kind, language_id, primary) = match name {
        "package.json" => ("package-manifest", package_language(path)?, true),
        "Cargo.toml" => ("cargo-manifest", "rust".to_owned(), true),
        "pyproject.toml" => ("python-manifest", "python".to_owned(), true),
        "go.mod" => ("go-manifest", "go".to_owned(), true),
        "composer.json" => ("composer-manifest", "php".to_owned(), true),
        "pnpm-workspace.yaml" => ("workspace-manifest", "typescript".to_owned(), false),
        "astro.config.ts" => ("astro-config", "typescript".to_owned(), false),
        "docusaurus.config.ts" => ("docusaurus-config", "typescript".to_owned(), false),
        _ => return Ok(None),
    };
    let directory = path.parent().context("manifest has no parent directory")?;
    let _ = root;
    Ok(Some(ManifestEvidence {
        path: relative_path.to_owned(),
        kind: kind.to_owned(),
        runtime_id: format!("runtime-{language_id}"),
        package_manager_id: package_manager_for(directory, &language_id, primary),
        lockfile_id: lockfile_for(directory, &language_id, primary),
        language_id,
    }))
}

fn package_language(path: &Path) -> Result<String> {
    let contents = fs::read_to_string(path).context("read package manifest")?;
    let package: JsonValue =
        serde_json::from_str(&contents).context("package manifest JSON is invalid")?;
    let has_type_script = path.parent().is_some_and(|directory| {
        directory.join("tsconfig.json").is_file()
            || [
                "dependencies",
                "devDependencies",
                "peerDependencies",
                "optionalDependencies",
            ]
            .iter()
            .filter_map(|key| package.get(*key).and_then(JsonValue::as_object))
            .flat_map(|dependencies| dependencies.keys())
            .any(|name| name == "typescript" || name.starts_with("@types/"))
    });
    Ok(if has_type_script {
        "typescript".to_owned()
    } else {
        "javascript".to_owned()
    })
}

fn package_manager_for(directory: &Path, language_id: &str, primary: bool) -> Option<String> {
    if !primary {
        return None;
    }
    let present = match language_id {
        "javascript" | "typescript" => ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]
            .iter()
            .any(|name| directory.join(name).is_file()),
        "rust" => directory.join("Cargo.lock").is_file(),
        "python" => directory.join("poetry.lock").is_file() || directory.join("uv.lock").is_file(),
        "go" => directory.join("go.sum").is_file(),
        "php" => directory.join("composer.lock").is_file(),
        _ => false,
    };
    present.then(|| format!("package-manager-{language_id}"))
}

fn lockfile_for(directory: &Path, language_id: &str, primary: bool) -> Option<String> {
    if !primary {
        return None;
    }
    let present = match language_id {
        "javascript" | "typescript" => ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]
            .iter()
            .any(|name| directory.join(name).is_file()),
        "rust" => directory.join("Cargo.lock").is_file(),
        "python" => directory.join("poetry.lock").is_file() || directory.join("uv.lock").is_file(),
        "go" => directory.join("go.sum").is_file(),
        "php" => directory.join("composer.lock").is_file(),
        _ => false,
    };
    present.then(|| format!("lockfile-{language_id}"))
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace(std::path::MAIN_SEPARATOR, "/")
}

pub fn extract_dependencies(
    root: &Path,
    manifests: &[ManifestEvidence],
) -> Result<BTreeMap<String, String>> {
    let mut dependencies = BTreeMap::new();
    for manifest in manifests.iter().filter(|item| is_primary(&item.kind)) {
        let path = root.join(&manifest.path);
        let contents = fs::read_to_string(&path)
            .with_context(|| format!("read manifest {}", manifest.path))?;
        let parsed = match manifest.language_id.as_str() {
            "javascript" | "typescript" | "php" => {
                parse_json_dependencies(&contents, &manifest.language_id)
                    .with_context(|| format!("parse manifest {}", manifest.path))?
            }
            "rust" | "python" => parse_toml_dependencies(&contents, &manifest.language_id)
                .with_context(|| format!("parse manifest {}", manifest.path))?,
            "go" => parse_go_dependencies(&contents)
                .with_context(|| format!("parse manifest {}", manifest.path))?,
            language => bail!("unsupported manifest language {language}"),
        };
        dependencies.extend(parsed);

        let directory = path.parent().context("manifest has no parent directory")?;
        if let Some(lockfile) = lockfile_for_name(directory, &manifest.language_id) {
            let lock_path = directory.join(&lockfile);
            let lock_contents = fs::read_to_string(&lock_path)
                .with_context(|| format!("read lockfile {}", relative(root, &lock_path)))?;
            let locked = parse_lockfile(&lockfile, &lock_contents)
                .with_context(|| format!("parse lockfile {}", relative(root, &lock_path)))?;
            for (name, version) in locked {
                dependencies.entry(name).or_insert(version);
            }
        }
    }
    Ok(dependencies)
}

fn is_primary(kind: &str) -> bool {
    matches!(
        kind,
        "package-manifest"
            | "cargo-manifest"
            | "python-manifest"
            | "go-manifest"
            | "composer-manifest"
    )
}

fn parse_json_dependencies(contents: &str, language: &str) -> Result<BTreeMap<String, String>> {
    let value: JsonValue = serde_json::from_str(contents).context("invalid JSON")?;
    let mut dependencies = BTreeMap::new();
    let sections: &[&str] = if language == "php" {
        &["require", "require-dev"]
    } else {
        &[
            "dependencies",
            "devDependencies",
            "peerDependencies",
            "optionalDependencies",
        ]
    };
    for section in sections {
        if let Some(table) = value.get(*section).and_then(JsonValue::as_object) {
            for (name, version) in table {
                let version = version
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| version.to_string());
                if name != "php" && !name.starts_with("ext-") {
                    dependencies.insert(name.clone(), version);
                }
            }
        }
    }
    Ok(dependencies)
}

fn parse_toml_dependencies(contents: &str, language: &str) -> Result<BTreeMap<String, String>> {
    let value: toml::Value = contents.parse().context("invalid TOML")?;
    let mut dependencies = BTreeMap::new();
    let sections: &[&str] = if language == "rust" {
        &["dependencies", "dev-dependencies", "build-dependencies"]
    } else {
        &[
            "project.dependencies",
            "poetry.dependencies",
            "tool.poetry.dependencies",
        ]
    };
    for section in sections {
        let mut current = Some(&value);
        for key in section.split('.') {
            current = current.and_then(|item| item.get(key));
        }
        let table = current.and_then(toml::Value::as_table);
        if let Some(table) = table {
            for (name, version) in table {
                dependencies.insert(name.clone(), toml_dependency_version(version));
            }
        }
    }
    if language == "python" {
        if let Some(items) = value
            .get("project")
            .and_then(|project| project.get("dependencies"))
            .and_then(toml::Value::as_array)
        {
            for item in items.iter().filter_map(toml::Value::as_str) {
                let name = item
                    .split(['=', '<', '>', '!', '~', ' '])
                    .next()
                    .unwrap_or(item);
                dependencies.insert(name.to_owned(), item.to_owned());
            }
        }
    }
    Ok(dependencies)
}

fn toml_dependency_version(value: &toml::Value) -> String {
    value
        .as_str()
        .map(str::to_owned)
        .or_else(|| {
            value
                .get("version")
                .and_then(toml::Value::as_str)
                .map(str::to_owned)
        })
        .unwrap_or_else(|| value.to_string())
}

fn parse_go_dependencies(contents: &str) -> Result<BTreeMap<String, String>> {
    let mut dependencies = BTreeMap::new();
    let mut in_block = false;
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("require (") {
            in_block = true;
            continue;
        }
        if in_block && trimmed == ")" {
            in_block = false;
            continue;
        }
        if trimmed.starts_with("require ") {
            if let Some((name, version)) =
                split_go_requirement(trimmed.trim_start_matches("require "))
            {
                dependencies.insert(name.to_owned(), version.to_owned());
            }
        } else if in_block && !trimmed.is_empty() && !trimmed.starts_with("//") {
            if let Some((name, version)) = split_go_requirement(trimmed) {
                dependencies.insert(name.to_owned(), version.to_owned());
            }
        }
    }
    Ok(dependencies)
}

fn split_go_requirement(line: &str) -> Option<(&str, &str)> {
    let mut fields = line.split_whitespace();
    Some((fields.next()?, fields.next()?))
}

fn lockfile_for_name(directory: &Path, language: &str) -> Option<String> {
    let names: &[&str] = match language {
        "javascript" | "typescript" => &["pnpm-lock.yaml", "package-lock.json", "yarn.lock"],
        "rust" => &["Cargo.lock"],
        "python" => &["poetry.lock", "uv.lock"],
        "go" => &["go.sum"],
        "php" => &["composer.lock"],
        _ => &[],
    };
    names
        .iter()
        .find(|name| directory.join(name).is_file())
        .map(|name| (*name).to_owned())
}

fn parse_lockfile(name: &str, contents: &str) -> Result<BTreeMap<String, String>> {
    match name {
        "pnpm-lock.yaml" => parse_pnpm_lock(contents),
        "package-lock.json" | "composer.lock" => parse_lock_json(contents),
        "Cargo.lock" | "poetry.lock" | "uv.lock" => parse_toml_lock(contents),
        "go.sum" => parse_go_sum(contents),
        "yarn.lock" => parse_yarn_lock(contents),
        _ => bail!("unsupported lockfile {name}"),
    }
}

fn parse_pnpm_lock(contents: &str) -> Result<BTreeMap<String, String>> {
    let value: serde_yaml::Value = serde_yaml::from_str(contents).context("invalid pnpm YAML")?;
    if let Some(version) = value.get("lockfileVersion") {
        let version = version
            .as_str()
            .map(str::to_owned)
            .or_else(|| version.as_f64().map(|number| number.to_string()))
            .context("pnpm lockfileVersion is invalid")?;
        let major = version
            .split('.')
            .next()
            .and_then(|part| part.parse::<u64>().ok())
            .context("pnpm lockfileVersion is invalid")?;
        if !(5..=9).contains(&major) {
            bail!("unsupported pnpm lockfileVersion {version}");
        }
    }
    let mut dependencies = BTreeMap::new();
    if let Some(packages) = value
        .get("packages")
        .and_then(serde_yaml::Value::as_mapping)
    {
        for key in packages.keys().filter_map(serde_yaml::Value::as_str) {
            if let Some((name, version)) = package_from_pnpm_key(key) {
                dependencies.entry(name).or_insert(version);
            }
        }
    }
    Ok(dependencies)
}

fn package_from_pnpm_key(key: &str) -> Option<(String, String)> {
    let key = key.trim_start_matches('/');
    let boundary = if let Some(stripped) = key.strip_prefix('@') {
        stripped.find('@').map(|index| index + 1)?
    } else {
        key.find('@')?
    };
    let name = key[..boundary].to_owned();
    let version = key[boundary + 1..].split('(').next()?.to_owned();
    (!name.is_empty() && !version.is_empty()).then_some((name, version))
}

fn parse_lock_json(contents: &str) -> Result<BTreeMap<String, String>> {
    let value: JsonValue = serde_json::from_str(contents).context("invalid lockfile JSON")?;
    let mut dependencies = BTreeMap::new();
    if let Some(packages) = value.get("packages").and_then(JsonValue::as_object) {
        for (key, item) in packages {
            if let Some(name) = key.strip_prefix("node_modules/") {
                if let Some(version) = item.get("version").and_then(JsonValue::as_str) {
                    dependencies.insert(name.to_owned(), version.to_owned());
                }
            }
        }
    }
    if let Some(packages) = value.get("packages").and_then(JsonValue::as_array) {
        for item in packages {
            if let (Some(name), Some(version)) = (
                item.get("name").and_then(JsonValue::as_str),
                item.get("version").and_then(JsonValue::as_str),
            ) {
                dependencies.insert(name.to_owned(), version.to_owned());
            }
        }
    }
    Ok(dependencies)
}

fn parse_toml_lock(contents: &str) -> Result<BTreeMap<String, String>> {
    let value: toml::Value = contents.parse().context("invalid lockfile TOML")?;
    let mut dependencies = BTreeMap::new();
    for key in ["package", "packages"] {
        if let Some(items) = value.get(key).and_then(toml::Value::as_array) {
            for item in items {
                if let (Some(name), Some(version)) = (
                    item.get("name").and_then(toml::Value::as_str),
                    item.get("version").and_then(toml::Value::as_str),
                ) {
                    dependencies.insert(name.to_owned(), version.to_owned());
                }
            }
        }
    }
    Ok(dependencies)
}

fn parse_go_sum(contents: &str) -> Result<BTreeMap<String, String>> {
    let mut dependencies = BTreeMap::new();
    for line in contents.lines().filter(|line| !line.trim().is_empty()) {
        let mut fields = line.split_whitespace();
        let name = fields.next().context("go.sum entry has no module")?;
        let version = fields.next().context("go.sum entry has no version")?;
        dependencies
            .entry(name.to_owned())
            .or_insert(version.trim_end_matches("/go.mod").to_owned());
    }
    Ok(dependencies)
}

fn parse_yarn_lock(contents: &str) -> Result<BTreeMap<String, String>> {
    let mut dependencies = BTreeMap::new();
    let mut current_names = Vec::new();
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if !line.starts_with(' ') && trimmed.ends_with(':') {
            current_names = trimmed
                .trim_end_matches(':')
                .split(',')
                .filter_map(|selector| selector.trim().trim_matches('"').split('@').next_back())
                .filter(|name| !name.is_empty())
                .map(str::to_owned)
                .collect();
        } else if let Some(version) = trimmed.strip_prefix("version:") {
            let version = version.trim().trim_matches('"');
            for name in &current_names {
                dependencies.insert(name.clone(), version.to_owned());
            }
        }
    }
    Ok(dependencies)
}

#[cfg(test)]
mod tests {
    use super::{extract_dependencies, parse_lockfile, scan};
    use std::fs;

    #[test]
    fn scans_mixed_manifests_and_prunes_dependency_trees() {
        let root = tempfile::tempdir().expect("temp project");
        fs::create_dir_all(root.path().join("node_modules/ignored")).expect("ignored dir");
        fs::create_dir_all(root.path().join("apps/rust")).expect("nested app");
        fs::write(
            root.path().join("package.json"),
            r#"{"name":"fixture","devDependencies":{"typescript":"^5"}}"#,
        )
        .expect("package");
        fs::write(
            root.path().join("pnpm-workspace.yaml"),
            "packages: [apps/*]\n",
        )
        .expect("workspace");
        fs::write(
            root.path().join("apps/rust/Cargo.toml"),
            "[package]\nname='fixture'\nversion='0.1.0'\n",
        )
        .expect("cargo");
        fs::write(
            root.path().join("node_modules/ignored/package.json"),
            "not json",
        )
        .expect("ignored file");
        let result = scan(root.path()).expect("scan");
        assert_eq!(result.manifests.len(), 3);
        assert!(result
            .manifests
            .iter()
            .any(|item| item.language_id == "typescript"));
        assert!(!result
            .files
            .iter()
            .any(|item| item.starts_with("node_modules/")));
    }

    #[test]
    fn extracts_json_and_toml_dependencies_deterministically() {
        let root = tempfile::tempdir().expect("temp project");
        fs::write(
            root.path().join("package.json"),
            r#"{"dependencies":{"bad":"1.0.0"}}"#,
        )
        .expect("package");
        fs::write(
            root.path().join("Cargo.toml"),
            "[dependencies]\nserde = '1'\n",
        )
        .expect("cargo");
        let manifests = scan(root.path()).expect("scan").manifests;
        let dependencies = extract_dependencies(root.path(), &manifests).expect("dependencies");
        assert_eq!(dependencies.get("bad"), Some(&"1.0.0".to_owned()));
        assert_eq!(dependencies.get("serde"), Some(&"1".to_owned()));
    }

    #[test]
    fn handles_empty_manifests_and_rejects_unsupported_lock_versions() {
        let root = tempfile::tempdir().expect("temp project");
        fs::write(root.path().join("package.json"), "{}\n").expect("empty package");
        let manifests = scan(root.path()).expect("scan").manifests;
        assert!(extract_dependencies(root.path(), &manifests)
            .expect("empty dependencies")
            .is_empty());
        assert!(parse_lockfile("pnpm-lock.yaml", "lockfileVersion: '99.0'\n").is_err());
    }

    #[test]
    fn merges_dependency_sections_in_stable_order() {
        let root = tempfile::tempdir().expect("temp project");
        fs::write(
            root.path().join("package.json"),
            r#"{"dependencies":{"zeta":"1"},"optionalDependencies":{"alpha":"2"},"devDependencies":{"middle":"3"}}"#,
        )
        .expect("package");
        let manifests = scan(root.path()).expect("scan").manifests;
        let dependencies = extract_dependencies(root.path(), &manifests).expect("dependencies");
        assert_eq!(
            dependencies.keys().map(String::as_str).collect::<Vec<_>>(),
            ["alpha", "middle", "zeta"]
        );
    }
}
