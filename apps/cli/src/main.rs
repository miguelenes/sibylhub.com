mod cli;
mod error;
mod policy;
mod scanner;
mod ui;

use anyhow::{bail, Context, Result};
use clap::Parser;
use policy::{PolicyIndex, PolicyViolation};
use scanner::{extract_dependencies, scan, ManifestEvidence};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
};

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct AgentConfig {
    #[serde(rename = "schemaVersion")]
    schema_version: String,
    project: String,
    mode: String,
    #[serde(rename = "runtimeOwners")]
    runtime_owners: BTreeMap<String, String>,
    #[serde(rename = "safeCommands")]
    safe_commands: Vec<String>,
    #[serde(rename = "manifestEvidence")]
    manifest_evidence: Vec<ManifestEvidence>,
    #[serde(rename = "invariantIds")]
    invariant_ids: Vec<String>,
    #[serde(rename = "remoteMutationRequiresExplicitCommand")]
    remote_mutation_requires_explicit_command: bool,
    #[serde(rename = "remoteEvidenceIsSeparate")]
    remote_evidence_is_separate: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SkillsDocument {
    #[serde(rename = "schemaVersion")]
    schema_version: String,
    skills: Vec<Skill>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Skill {
    id: String,
    scope: String,
    declarative: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct MemoryEntry {
    title: String,
    content: String,
    category: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct MemoriesDocument {
    #[serde(rename = "schemaVersion")]
    schema_version: String,
    memories: Vec<MemoryEntry>,
}

#[derive(Debug, Serialize)]
struct Diagnostic {
    code: &'static str,
    message: String,
    path: Option<String>,
}

#[derive(Debug, Serialize)]
struct CheckReport {
    valid: bool,
    compliant: bool,
    policy_configured: bool,
    diagnostics: Vec<Diagnostic>,
    violations: Vec<PolicyViolation>,
}

#[tokio::main]
async fn main() {
    let result = match cli::Cli::parse().command {
        cli::Commands::Init(args) => init(&args.path, args.force),
        cli::Commands::Check(args) => {
            check_with_registry(&args.path, args.json, args.registry.as_deref())
        }
        cli::Commands::Sync(args) => sync(&args.payload).await,
        cli::Commands::Memory(args) => match args.command {
            cli::MemoryCommands::Add(args) => memory_add(
                &args.path,
                &args.title,
                &args.content,
                &args.category,
                args.force,
                args.json,
            ),
        },
    };
    if let Err(error) = result {
        let error = error::AppError::from(error);
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn init(path: &Path, force: bool) -> Result<()> {
    let result = scan(path)?;
    if result.manifests.is_empty() {
        bail!("no supported primary manifest or supplementary stack evidence found");
    }
    let mut runtime_owners = BTreeMap::new();
    let mut invariant_ids = BTreeSet::new();
    for item in &result.manifests {
        runtime_owners.insert(item.runtime_id.clone(), "workspace".to_owned());
        if !item.kind.ends_with("-config") && item.kind != "workspace-manifest" {
            invariant_ids.insert(format!("invariant-{}", item.language_id));
        }
    }
    let config = AgentConfig {
        schema_version: "1.0".to_owned(),
        project: project_name(path),
        mode: "declarative".to_owned(),
        runtime_owners,
        safe_commands: vec!["sibyl check --json".to_owned()],
        manifest_evidence: result.manifests,
        invariant_ids: invariant_ids.into_iter().collect(),
        remote_mutation_requires_explicit_command: true,
        remote_evidence_is_separate: true,
    };
    let skills = SkillsDocument {
        schema_version: "1.0".to_owned(),
        skills: config
            .runtime_owners
            .keys()
            .map(|runtime| Skill {
                id: runtime.trim_start_matches("runtime-").to_owned(),
                scope: "workspace".to_owned(),
                declarative: true,
            })
            .collect(),
    };
    let memories = MemoriesDocument {
        schema_version: "1.0".to_owned(),
        memories: Vec::new(),
    };
    let files = vec![
        ("config.json", json_bytes(&config)?),
        ("skills.json", json_bytes(&skills)?),
        ("memories.json", json_bytes(&memories)?),
        ("rules.md", FIXED_RULES.as_bytes().to_vec()),
        ("context.ignore", FIXED_CONTEXT_IGNORE.as_bytes().to_vec()),
    ];
    write_governance(path, &files, force)?;
    for (name, _) in files {
        println!("created .agent/{name}");
    }
    Ok(())
}

fn check_with_registry(path: &Path, json: bool, registry: Option<&Path>) -> Result<()> {
    let mut diagnostics = Vec::new();
    let result = scan(path)?;
    let config_path = path.join(".agent/config.json");
    let config = match read_json::<AgentConfig>(&config_path) {
        Ok(config) => Some(config),
        Err(error) => {
            diagnostics.push(Diagnostic {
                code: "config_missing_or_invalid",
                message: "a schema-valid .agent/config.json is required".to_owned(),
                path: Some(".agent/config.json".to_owned()),
            });
            let _ = error;
            None
        }
    };
    if let Some(config) = &config {
        if config.schema_version != "1.0" {
            diagnostics.push(Diagnostic {
                code: "unsupported_schema",
                message: "agent config schemaVersion must be 1.0".to_owned(),
                path: Some("schemaVersion".to_owned()),
            });
        }
        if config.mode != "declarative"
            || !config.remote_mutation_requires_explicit_command
            || !config.remote_evidence_is_separate
        {
            diagnostics.push(Diagnostic {
                code: "unsafe_controls",
                message: "agent config must remain declarative and keep remote evidence separate"
                    .to_owned(),
                path: None,
            });
        }
        for evidence in &config.manifest_evidence {
            if !result.manifests.iter().any(|item| item == evidence) {
                diagnostics.push(Diagnostic {
                    code: "manifest_evidence_stale",
                    message: "declared manifest evidence differs from the current local scan"
                        .to_owned(),
                    path: Some(evidence.path.clone()),
                });
            }
        }
    }
    if result.manifests.is_empty() {
        diagnostics.push(Diagnostic {
            code: "no_manifest_evidence",
            message: "no supported primary manifest or supplementary stack evidence was found"
                .to_owned(),
            path: None,
        });
    }
    validate_optional_documents(path, &mut diagnostics);

    let primary = result
        .manifests
        .iter()
        .filter(|item| is_primary_kind(&item.kind))
        .cloned()
        .collect::<Vec<_>>();
    let mut all_dependencies = BTreeMap::new();
    let mut per_manifest = Vec::new();
    for manifest in &primary {
        match extract_dependencies(path, std::slice::from_ref(manifest)) {
            Ok(dependencies) => {
                all_dependencies.extend(dependencies.clone());
                per_manifest.push((manifest, dependencies));
            }
            Err(error) => diagnostics.push(Diagnostic {
                code: "manifest_or_lockfile_invalid",
                message: error.to_string(),
                path: Some(manifest.path.clone()),
            }),
        }
    }

    let policy = match registry {
        Some(source) => {
            Some(PolicyIndex::load(source).with_context(|| "load local registry policy")?)
        }
        None => None,
    };
    let mut violations = Vec::new();
    if policy.is_none() && !all_dependencies.is_empty() {
        diagnostics.push(Diagnostic {
            code: "package_policy_not_configured",
            message: "package policy is not configured; provide a local registry snapshot"
                .to_owned(),
            path: None,
        });
    }
    if let Some(policy) = &policy {
        for (manifest, dependencies) in per_manifest {
            violations.extend(policy.evaluate(
                &manifest.language_id,
                &manifest.runtime_id,
                &dependencies,
            ));
        }
        violations.sort_by(|left, right| {
            left.package
                .cmp(&right.package)
                .then(left.reason.cmp(&right.reason))
        });
        violations.dedup();
        for violation in &violations {
            diagnostics.push(Diagnostic {
                code: "package_policy_violation",
                message: format!("{}: {}", violation.package, violation.reason),
                path: Some(violation.package.clone()),
            });
        }
    }
    let valid = diagnostics.is_empty();
    let report = CheckReport {
        valid,
        compliant: valid,
        policy_configured: policy.is_some(),
        diagnostics,
        violations,
    };
    ui::print_check(&report, json)?;
    if valid {
        Ok(())
    } else {
        bail!("project is not compliant")
    }
}

fn validate_optional_documents(path: &Path, diagnostics: &mut Vec<Diagnostic>) {
    for (name, expected) in [("skills.json", "skills"), ("memories.json", "memories")] {
        let document_path = path.join(".agent").join(name);
        if !document_path.exists() {
            continue;
        }
        let value = match read_json_value(&document_path) {
            Ok(value) => value,
            Err(_) => {
                diagnostics.push(Diagnostic {
                    code: "governance_document_invalid",
                    message: format!(".agent/{name} is not valid JSON"),
                    path: Some(format!(".agent/{name}")),
                });
                continue;
            }
        };
        if (expected == "memories"
            && serde_json::from_value::<MemoriesDocument>(value.clone()).is_err())
            || (expected == "skills" && serde_json::from_value::<SkillsDocument>(value).is_err())
        {
            diagnostics.push(Diagnostic {
                code: "governance_document_invalid",
                message: format!(".agent/{name} has an unsupported or malformed schema"),
                path: Some(format!(".agent/{name}")),
            });
        }
    }
    let invariant_path = path.join(".agent/invariants.json");
    if invariant_path.is_file() {
        match read_json_value(&invariant_path) {
            Ok(value) => {
                if contains_unsafe_material(&value) {
                    diagnostics.push(Diagnostic {
                        code: "unsafe_governance_document",
                        message:
                            "invariant metadata contains prohibited secret or execution material"
                                .to_owned(),
                        path: Some(".agent/invariants.json".to_owned()),
                    });
                }
            }
            Err(_) => diagnostics.push(Diagnostic {
                code: "governance_document_invalid",
                message: ".agent/invariants.json is not valid JSON".to_owned(),
                path: Some(".agent/invariants.json".to_owned()),
            }),
        }
    }
}

fn memory_add(
    path: &Path,
    title: &str,
    content: &str,
    category: &str,
    force: bool,
    json: bool,
) -> Result<()> {
    let entry = MemoryEntry {
        title: title.trim().to_owned(),
        content: content.trim().to_owned(),
        category: category.trim().to_owned(),
    };
    if entry.title.is_empty() || entry.content.is_empty() || entry.category.is_empty() {
        bail!("memory title, content, and category must be nonempty");
    }
    let candidate = serde_json::json!({"schemaVersion":"1.0","memories":[entry]});
    if contains_unsafe_material(&candidate) {
        bail!("memory contains prohibited secret or execution material");
    }
    let memory_path = path.join(".agent/memories.json");
    let mut document = if memory_path.exists() {
        read_json::<MemoriesDocument>(&memory_path).context("read .agent/memories.json")?
    } else {
        MemoriesDocument {
            schema_version: "1.0".to_owned(),
            memories: Vec::new(),
        }
    };
    if document.schema_version != "1.0" {
        bail!(".agent/memories.json schemaVersion must be 1.0");
    }
    document.memories.push(entry);
    let bytes = json_bytes(&document)?;
    let _ = force;
    atomic_write(&memory_path, &bytes)?;
    if json {
        println!(
            "{}",
            serde_json::json!({"path":".agent/memories.json","count":document.memories.len()})
        );
    } else {
        println!(
            "appended .agent/memories.json ({} entr{})",
            document.memories.len(),
            if document.memories.len() == 1 {
                "y"
            } else {
                "ies"
            }
        );
    }
    Ok(())
}

fn write_governance(path: &Path, files: &[(&str, Vec<u8>)], force: bool) -> Result<()> {
    let agent_dir = path.join(".agent");
    let conflicts = files
        .iter()
        .filter(|(name, _)| agent_dir.join(name).exists())
        .map(|(name, _)| *name)
        .collect::<Vec<_>>();
    if !conflicts.is_empty() && !force {
        bail!(
            "governance files already exist: {}; pass --force after reviewing them",
            conflicts.join(", ")
        );
    }
    fs::create_dir_all(&agent_dir).context("create .agent directory")?;
    let mut temporary = Vec::new();
    for (name, contents) in files {
        let temporary_path = agent_dir.join(format!(".{name}.sibyl-tmp-{}", std::process::id()));
        if let Err(error) = fs::write(&temporary_path, contents) {
            for path in &temporary {
                let _ = fs::remove_file(path);
            }
            return Err(error).with_context(|| format!("write temporary .agent/{name}"));
        }
        temporary.push(temporary_path);
    }
    for ((name, _), temporary_path) in files.iter().zip(&temporary) {
        if let Err(error) = fs::rename(temporary_path, agent_dir.join(name)) {
            for path in &temporary {
                let _ = fs::remove_file(path);
            }
            return Err(error).with_context(|| format!("replace .agent/{name}"));
        }
    }
    Ok(())
}

fn atomic_write(path: &Path, contents: &[u8]) -> Result<()> {
    fs::create_dir_all(path.parent().context("resolve destination directory")?)?;
    let temporary_path = path.with_file_name(format!(
        ".{}.sibyl-tmp-{}",
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("document"),
        std::process::id()
    ));
    fs::write(&temporary_path, contents).context("write temporary document")?;
    fs::rename(&temporary_path, path).context("replace document")?;
    Ok(())
}

fn json_bytes<T: Serialize>(value: &T) -> Result<Vec<u8>> {
    let mut bytes = serde_json::to_vec_pretty(value)?;
    bytes.push(b'\n');
    Ok(bytes)
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
    let value = read_json_value(path)?;
    serde_json::from_value(value).context("JSON document has unsupported fields or types")
}

fn read_json_value(path: &Path) -> Result<Value> {
    let contents = fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    serde_json::from_str(&contents).with_context(|| format!("parse {}", path.display()))
}

fn contains_unsafe_material(value: &Value) -> bool {
    fn visit(value: &Value) -> bool {
        match value {
            Value::Object(object) => object.iter().any(|(key, value)| {
                let key = key.to_ascii_lowercase();
                key.contains("password")
                    || key == "token"
                    || key.contains("secret")
                    || key.contains("private_key")
                    || key == "command"
                    || key == "exec"
                    || key == "script"
                    || visit(value)
            }),
            Value::Array(items) => items.iter().any(visit),
            Value::String(text) => {
                let lower = text.to_ascii_lowercase();
                lower.contains("-----begin ")
                    || ["token:", "password:", "secret:", "api_key:", "private key:"]
                        .iter()
                        .any(|needle| lower.contains(needle))
            }
            _ => false,
        }
    }
    visit(value)
}

async fn sync(payload: &Path) -> Result<()> {
    let endpoint =
        std::env::var("SIBYL_SYNC_ENDPOINT").context("SIBYL_SYNC_ENDPOINT is required")?;
    let token =
        std::env::var("SIBYL_SYNC_AUTH_TOKEN").context("SIBYL_SYNC_AUTH_TOKEN is required")?;
    let url = reqwest::Url::parse(&endpoint).context("sync endpoint is invalid")?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || token.trim().is_empty()
    {
        bail!("sync endpoint and authorization are invalid");
    }
    let body = fs::read_to_string(payload).context("read sync payload")?;
    validate_sync_payload(&body)?;
    let spinner = ui::sync_spinner();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    for attempt in 0..3 {
        let response = match client
            .post(url.clone())
            .bearer_auth(&token)
            .body(body.clone())
            .send()
            .await
        {
            Ok(response) => response,
            Err(_) if attempt < 2 => continue,
            Err(_) => {
                spinner.finish_and_clear();
                bail!("remote synchronization transport failed after bounded retries");
            }
        };
        if !response.status().is_success() {
            spinner.finish_and_clear();
            bail!(
                "remote synchronization failed with status {}",
                response.status()
            );
        }
        spinner.finish_and_clear();
        println!("remote acknowledgement received");
        return Ok(());
    }
    spinner.finish_and_clear();
    bail!("remote synchronization did not complete")
}

fn validate_sync_payload(body: &str) -> Result<()> {
    let value: Value = serde_json::from_str(body).context("sync payload is not JSON")?;
    if value.get("schemaVersion").and_then(Value::as_str) != Some("1.0") {
        bail!("sync payload schema version is unsupported");
    }
    let kind = value
        .get("kind")
        .and_then(Value::as_str)
        .context("sync payload kind is required")?;
    if !matches!(kind, "episodic-memory" | "ast-skeleton") {
        bail!("sync payload kind is unsupported");
    }
    if contains_unsafe_material(&value) {
        bail!("sync payload contains prohibited secret or execution material");
    }
    Ok(())
}

fn is_primary_kind(kind: &str) -> bool {
    matches!(
        kind,
        "package-manifest"
            | "cargo-manifest"
            | "python-manifest"
            | "go-manifest"
            | "composer-manifest"
    )
}

fn project_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("project")
        .to_owned()
}

const FIXED_RULES: &str = "# SibylHub agent rules\n\n- Keep project governance declarative.\n- Use sibyl check for local validation.\n- Use sibyl sync only when explicitly authorized.\n";
const FIXED_CONTEXT_IGNORE: &str =
    "# Generated and dependency trees\nnode_modules/\ntarget/\nvendor/\n.git/\n";

#[cfg(test)]
mod tests {
    use super::{check_with_registry, init, memory_add};
    use std::fs;

    #[test]
    fn init_creates_all_governance_documents_and_check_reads_them() {
        let root = tempfile::tempdir().expect("temp project");
        fs::write(root.path().join("package.json"), r#"{"name":"fixture"}"#).expect("package");
        init(root.path(), false).expect("init");
        for name in [
            "config.json",
            "rules.md",
            "skills.json",
            "memories.json",
            "context.ignore",
        ] {
            assert!(
                root.path().join(".agent").join(name).is_file(),
                "missing {name}"
            );
        }
        check_with_registry(root.path(), true, None).expect("check");
    }

    #[test]
    fn memory_add_preserves_order() {
        let root = tempfile::tempdir().expect("temp project");
        memory_add(root.path(), "first", "content", "invariant", false, true).expect("first");
        memory_add(root.path(), "second", "content", "gotcha", false, true).expect("second");
        let document =
            fs::read_to_string(root.path().join(".agent/memories.json")).expect("memory document");
        assert!(
            document.find("first").expect("first entry")
                < document.find("second").expect("second entry")
        );
    }
}
