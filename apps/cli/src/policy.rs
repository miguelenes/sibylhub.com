use anyhow::{bail, Context, Result};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Component, Path, PathBuf},
};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct PolicyViolation {
    pub package: String,
    pub severity: String,
    pub approved_replacement: Option<String>,
    pub reason: String,
}

#[derive(Debug, Clone)]
struct PolicyRule {
    languages: BTreeSet<String>,
    banned: BTreeSet<String>,
    approved_replacement: Option<String>,
    severity: String,
    reason: String,
}

#[derive(Debug, Clone, Default)]
pub struct PolicyIndex {
    rules: Vec<PolicyRule>,
}

impl PolicyIndex {
    pub fn load(source: &Path) -> Result<Self> {
        reject_remote_source(source)?;
        let (_root, index_path) = if source.is_dir() {
            (source.to_path_buf(), source.join("data/v1/index.json"))
        } else {
            (
                source
                    .parent()
                    .context("registry source has no parent directory")?
                    .to_path_buf(),
                source.to_path_buf(),
            )
        };
        let contents = fs::read_to_string(&index_path)
            .with_context(|| format!("read local registry {}", index_path.display()))?;
        let value: Value =
            serde_json::from_str(&contents).context("local registry JSON is invalid")?;
        let schema_version = value
            .get("schemaVersion")
            .and_then(Value::as_str)
            .context("local registry schemaVersion is required")?;
        match schema_version {
            "1.0" => Self::from_legacy(&value),
            "2.0" => Self::from_split(
                index_path
                    .parent()
                    .context("registry index has no parent")?,
                &index_path,
                &value,
            ),
            version => bail!("unsupported local registry schema version {version}"),
        }
    }

    pub fn evaluate(
        &self,
        language: &str,
        runtime: &str,
        dependencies: &BTreeMap<String, String>,
    ) -> Vec<PolicyViolation> {
        let mut violations = Vec::new();
        let language = normalize(language);
        let runtime = normalize(runtime);
        for package in dependencies.keys() {
            let package_key = normalize(package);
            for rule in &self.rules {
                if !rule.languages.is_empty()
                    && !rule.languages.contains(&language)
                    && !rule.languages.contains(&runtime)
                {
                    continue;
                }
                if rule.banned.contains(&package_key) {
                    violations.push(PolicyViolation {
                        package: package.clone(),
                        severity: rule.severity.clone(),
                        approved_replacement: rule.approved_replacement.clone(),
                        reason: rule.reason.clone(),
                    });
                    break;
                }
            }
        }
        violations.sort_by(|left, right| {
            left.package
                .cmp(&right.package)
                .then(left.severity.cmp(&right.severity))
                .then(left.reason.cmp(&right.reason))
        });
        violations
    }

    fn from_legacy(value: &Value) -> Result<Self> {
        let mut aliases = BTreeMap::new();
        collect_package_aliases(value, &mut aliases);
        let mut rules = Vec::new();
        collect_rules(value, None, &aliases, &mut rules);
        Ok(Self { rules })
    }

    fn from_split(root: &Path, index_path: &Path, value: &Value) -> Result<Self> {
        let revision = value
            .get("revisionId")
            .and_then(Value::as_str)
            .context("local registry revisionId is required")?;
        let entries = value
            .get("languages")
            .and_then(Value::as_array)
            .context("local registry languages are required")?;
        let mut rules = Vec::new();
        for entry in entries {
            let language_id = entry
                .get("id")
                .and_then(Value::as_str)
                .context("registry language id is required")?;
            let relative_path = entry
                .get("path")
                .and_then(Value::as_str)
                .context("registry language path is required")?;
            let language_path = safe_relative_path(root, relative_path)?;
            let contents = fs::read_to_string(&language_path).with_context(|| {
                format!("read local language artifact {}", language_path.display())
            })?;
            let artifact: Value = serde_json::from_str(&contents).with_context(|| {
                format!("parse local language artifact {}", language_path.display())
            })?;
            if artifact.get("schemaVersion").and_then(Value::as_str) != Some("2.0")
                || artifact.get("revisionId").and_then(Value::as_str) != Some(revision)
            {
                bail!(
                    "registry language artifact identity does not match {}",
                    relative_path
                );
            }
            if artifact
                .get("language")
                .and_then(|language| language.get("id"))
                .and_then(Value::as_str)
                != Some(language_id)
            {
                bail!(
                    "registry language artifact id does not match {}",
                    relative_path
                );
            }
            let mut aliases = BTreeMap::new();
            collect_package_aliases(&artifact, &mut aliases);
            collect_rules(&artifact, Some(language_id), &aliases, &mut rules);
        }
        let _ = index_path;
        Ok(Self { rules })
    }
}

fn reject_remote_source(source: &Path) -> Result<()> {
    let text = source.to_string_lossy();
    if text.contains("://") {
        bail!("registry source must be a local path; remote sources are not allowed");
    }
    Ok(())
}

fn safe_relative_path(root: &Path, relative: &str) -> Result<PathBuf> {
    let path = Path::new(relative);
    if path.is_absolute()
        || relative.contains("://")
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)))
    {
        bail!("registry artifact path is not a safe relative path");
    }
    let candidate = root.join(path);
    let canonical_root = root.canonicalize().context("canonicalize registry root")?;
    let canonical_candidate = candidate
        .canonicalize()
        .context("canonicalize registry artifact")?;
    if !canonical_candidate.starts_with(&canonical_root) {
        bail!("registry artifact path escapes the local registry");
    }
    Ok(canonical_candidate)
}

fn collect_package_aliases(value: &Value, aliases: &mut BTreeMap<String, BTreeSet<String>>) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_package_aliases(item, aliases);
            }
        }
        Value::Object(object) => {
            if object.contains_key("id")
                && (object.contains_key("purl")
                    || object.contains_key("slug")
                    || object.contains_key("name"))
            {
                if let Some(id) = object.get("id").and_then(Value::as_str) {
                    let entry = aliases.entry(id.to_owned()).or_default();
                    for key in ["id", "slug", "name"] {
                        if let Some(alias) = object.get(key).and_then(Value::as_str) {
                            entry.insert(normalize(alias));
                        }
                    }
                }
            }
            for item in object.values() {
                collect_package_aliases(item, aliases);
            }
        }
        _ => {}
    }
}

fn collect_rules(
    value: &Value,
    language: Option<&str>,
    aliases: &BTreeMap<String, BTreeSet<String>>,
    rules: &mut Vec<PolicyRule>,
) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_rules(item, language, aliases, rules);
            }
        }
        Value::Object(object) => {
            let current_language = object
                .get("languageId")
                .and_then(Value::as_str)
                .or(language);
            let banned = object
                .get("bannedPackageId")
                .or_else(|| object.get("bannedPackage"))
                .or_else(|| object.get("banned"))
                .and_then(Value::as_str);
            if let Some(banned) = banned {
                let mut banned_aliases = aliases.get(banned).cloned().unwrap_or_default();
                banned_aliases.insert(normalize(banned));
                let approved = object
                    .get("approvedPackageId")
                    .or_else(|| object.get("approvedReplacement"))
                    .or_else(|| object.get("approvedPackage"))
                    .and_then(Value::as_str);
                let approved_replacement = approved.map(|value| {
                    aliases
                        .get(value)
                        .and_then(|items| {
                            items
                                .iter()
                                .find(|item| *item == &normalize(value))
                                .or_else(|| items.iter().next())
                        })
                        .cloned()
                        .unwrap_or_else(|| value.to_owned())
                });
                let languages = current_language
                    .map(|value| [normalize(value)].into_iter().collect())
                    .unwrap_or_default();
                rules.push(PolicyRule {
                    languages,
                    banned: banned_aliases,
                    approved_replacement,
                    severity: object
                        .get("severity")
                        .and_then(Value::as_str)
                        .unwrap_or("error")
                        .to_owned(),
                    reason: object
                        .get("reason")
                        .and_then(Value::as_str)
                        .unwrap_or("package is prohibited by a local invariant")
                        .to_owned(),
                });
            }
            for (key, item) in object {
                if key != "packages" {
                    collect_rules(item, current_language, aliases, rules);
                }
            }
        }
        _ => {}
    }
}

fn normalize(value: &str) -> String {
    value.trim().to_ascii_lowercase().replace('_', "-")
}

#[cfg(test)]
mod tests {
    use super::PolicyIndex;
    use std::{collections::BTreeMap, fs};

    #[test]
    fn loads_split_registry_and_evaluates_aliases() {
        let root = tempfile::tempdir().expect("registry");
        fs::create_dir_all(root.path().join("data/v1/languages")).expect("registry tree");
        fs::write(
            root.path().join("data/v1/index.json"),
            r#"{"schemaVersion":"2.0","revisionId":"sha256:test","languages":[{"id":"javascript","path":"languages/javascript.json"}]}"#,
        )
        .expect("index");
        fs::write(
            root.path().join("data/v1/languages/javascript.json"),
            r#"{"schemaVersion":"2.0","revisionId":"sha256:test","language":{"id":"javascript"},"packages":[{"id":"package-bad","slug":"bad","name":"Bad"},{"id":"package-good","slug":"good","name":"Good"}],"invariants":[{"id":"invariant-javascript","bannedPackageId":"package-bad","approvedPackageId":"package-good","severity":"error","reason":"Use good."}]}"#,
        )
        .expect("language artifact");
        let index = PolicyIndex::load(root.path()).expect("load policy");
        let mut dependencies = BTreeMap::new();
        dependencies.insert("bad".to_owned(), "1.0.0".to_owned());
        let violations = index.evaluate("javascript", "runtime-javascript", &dependencies);
        assert_eq!(violations[0].package, "bad");
        assert_eq!(
            violations[0].approved_replacement.as_deref(),
            Some("package-good")
        );
    }

    #[test]
    fn rejects_remote_registry_sources() {
        assert!(PolicyIndex::load(std::path::Path::new("https://example.test/registry")).is_err());
    }
}
