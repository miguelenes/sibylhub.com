use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Parser)]
#[command(
    name = "sibyl",
    version,
    about = "Read-only project checks and explicit synchronization"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    Init {
        #[arg(long, default_value = ".")]
        path: PathBuf,
        #[arg(long)]
        force: bool,
    },
    Check {
        #[arg(long, default_value = ".")]
        path: PathBuf,
        #[arg(long)]
        json: bool,
    },
    Sync {
        #[arg(long)]
        payload: PathBuf,
    },
}

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
struct ManifestEvidence {
    path: String,
    kind: String,
    #[serde(rename = "languageId")]
    language_id: String,
    #[serde(rename = "runtimeId")]
    runtime_id: String,
    #[serde(rename = "packageManagerId", skip_serializing_if = "Option::is_none")]
    package_manager_id: Option<String>,
    #[serde(rename = "lockfileId", skip_serializing_if = "Option::is_none")]
    lockfile_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct Diagnostic {
    code: &'static str,
    message: String,
    path: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    match Cli::parse().command {
        Commands::Init { path, force } => init(&path, force),
        Commands::Check { path, json } => check(&path, json),
        Commands::Sync { payload } => sync(&payload).await,
    }
}

const MANIFESTS: [(&str, &str, &str); 6] = [
    ("package.json", "package-manifest", "javascript"),
    ("pnpm-workspace.yaml", "workspace-manifest", "typescript"),
    ("Cargo.toml", "cargo-manifest", "rust"),
    ("composer.json", "composer-manifest", "php"),
    ("astro.config.ts", "astro-config", "typescript"),
    ("docusaurus.config.ts", "docusaurus-config", "typescript"),
];

fn lockfile_for(path: &Path, language_id: &str) -> Option<String> {
    let names = [
        ("pnpm-lock.yaml", "pnpm"),
        ("package-lock.json", "npm"),
        ("yarn.lock", "yarn"),
        ("Cargo.lock", "cargo"),
        ("composer.lock", "composer"),
    ];
    names
        .iter()
        .find(|(name, _)| path.join(name).is_file())
        .map(|(_, _)| format!("lockfile-{language_id}"))
}

fn package_manager_for(path: &Path, language_id: &str) -> Option<String> {
    if path.join("pnpm-lock.yaml").is_file()
        || path.join("package-lock.json").is_file()
        || path.join("yarn.lock").is_file()
        || path.join("Cargo.lock").is_file()
        || path.join("composer.lock").is_file()
    {
        Some(format!("package-manager-{language_id}"))
    } else {
        None
    }
}

fn manifest_evidence(path: &Path) -> Vec<ManifestEvidence> {
    MANIFESTS
        .iter()
        .filter_map(|(name, kind, language_id)| {
            if !path.join(name).is_file() {
                return None;
            }
            Some(ManifestEvidence {
                path: (*name).to_owned(),
                kind: (*kind).to_owned(),
                language_id: (*language_id).to_owned(),
                runtime_id: format!("runtime-{language_id}"),
                package_manager_id: package_manager_for(path, language_id),
                lockfile_id: lockfile_for(path, language_id),
            })
        })
        .collect()
}

fn init(path: &Path, force: bool) -> Result<()> {
    let config_path = path.join(".agent/config.json");
    if config_path.exists() && !force {
        bail!(".agent/config.json already exists; pass --force after reviewing it");
    }
    let evidence = manifest_evidence(path);
    let mut runtime_owners = BTreeMap::new();
    for item in &evidence {
        runtime_owners.insert(item.runtime_id.clone(), "workspace".to_owned());
    }
    let invariant_ids = evidence
        .iter()
        .map(|item| format!("invariant-{}", item.language_id))
        .collect::<Vec<_>>();
    let config = AgentConfig {
        schema_version: "1.0".to_owned(),
        project: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("project")
            .to_owned(),
        mode: "declarative".to_owned(),
        runtime_owners,
        safe_commands: vec!["sibyl check --json".to_owned()],
        manifest_evidence: evidence,
        invariant_ids,
        remote_mutation_requires_explicit_command: true,
        remote_evidence_is_separate: true,
    };
    fs::create_dir_all(config_path.parent().context("resolve .agent directory")?)?;
    fs::write(
        &config_path,
        format!("{}\n", serde_json::to_string_pretty(&config)?),
    )
    .context("write agent config")?;
    println!("created {}", config_path.display());
    Ok(())
}

fn check(path: &Path, json: bool) -> Result<()> {
    let mut diagnostics = Vec::new();
    let config_path = path.join(".agent/config.json");
    let config = match fs::read_to_string(&config_path).and_then(|contents| {
        serde_json::from_str::<AgentConfig>(&contents).map_err(std::io::Error::other)
    }) {
        Ok(config) => config,
        Err(_) => {
            diagnostics.push(Diagnostic {
                code: "config_missing_or_invalid",
                message: "a schema-valid .agent/config.json is required".to_owned(),
                path: Some(".agent/config.json".to_owned()),
            });
            AgentConfig {
                schema_version: String::new(),
                project: String::new(),
                mode: String::new(),
                runtime_owners: BTreeMap::new(),
                safe_commands: Vec::new(),
                manifest_evidence: Vec::new(),
                invariant_ids: Vec::new(),
                remote_mutation_requires_explicit_command: false,
                remote_evidence_is_separate: false,
            }
        }
    };
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
    if config.manifest_evidence.is_empty() {
        diagnostics.push(Diagnostic {
            code: "no_manifest_evidence",
            message: "no supported manifest evidence was declared".to_owned(),
            path: Some("manifestEvidence".to_owned()),
        });
    }
    let snapshot: serde_json::Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../packages/schemas/fixtures/valid-ecosystem.json"
    )))
    .context("parse bundled ecosystem contract")?;
    for evidence in &config.manifest_evidence {
        let manifest_path = path.join(&evidence.path);
        if !manifest_path.is_file() {
            diagnostics.push(Diagnostic {
                code: "manifest_missing",
                message: "declared manifest evidence path does not exist".to_owned(),
                path: Some(evidence.path.clone()),
            });
            continue;
        }
        if let Err(error) = parse_manifest(&manifest_path) {
            diagnostics.push(Diagnostic {
                code: "manifest_invalid",
                message: error.to_string(),
                path: Some(evidence.path.clone()),
            });
        }
        let Some(language) = find(&snapshot, "languages", &evidence.language_id) else {
            diagnostics.push(Diagnostic {
                code: "unknown_language",
                message: "manifest language is not in the registry".to_owned(),
                path: Some(evidence.language_id.clone()),
            });
            continue;
        };
        if language
            .get("runtimeId")
            .and_then(serde_json::Value::as_str)
            != Some(evidence.runtime_id.as_str())
        {
            diagnostics.push(Diagnostic {
                code: "runtime_mismatch",
                message: "manifest runtime evidence does not match the registry".to_owned(),
                path: Some(evidence.path.clone()),
            });
        }
        let invariant_id = format!("invariant-{}", evidence.language_id);
        if !config.invariant_ids.contains(&invariant_id) {
            diagnostics.push(Diagnostic {
                code: "invariant_not_selected",
                message: "manifest language has no selected invariant".to_owned(),
                path: Some(invariant_id),
            });
            continue;
        }
        let Some(invariant) = find(&snapshot, "invariants", &invariant_id) else {
            diagnostics.push(Diagnostic {
                code: "unknown_invariant",
                message: "selected invariant is not in the registry".to_owned(),
                path: Some(invariant_id),
            });
            continue;
        };
        let fields = invariant
            .get("evidenceFields")
            .and_then(serde_json::Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(serde_json::Value::as_str)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if fields.contains(&"lockfileId")
            && evidence.lockfile_id.as_deref()
                != Some(format!("lockfile-{}", evidence.language_id).as_str())
        {
            diagnostics.push(Diagnostic {
                code: "lockfile_missing",
                message: "the selected invariant requires lockfile evidence".to_owned(),
                path: Some(evidence.path.clone()),
            });
        }
        if fields.contains(&"packageManagerId")
            && evidence.package_manager_id.as_deref()
                != Some(format!("package-manager-{}", evidence.language_id).as_str())
        {
            diagnostics.push(Diagnostic {
                code: "package_manager_missing",
                message: "the selected invariant requires package-manager evidence".to_owned(),
                path: Some(evidence.path.clone()),
            });
        }
        if fields.contains(&"manifestPaths") && evidence.path.trim().is_empty() {
            diagnostics.push(Diagnostic {
                code: "manifest_missing",
                message: "the selected invariant requires manifest evidence".to_owned(),
                path: Some(evidence.path.clone()),
            });
        }
    }
    let valid = diagnostics.is_empty();
    if json {
        println!(
            "{}",
            serde_json::json!({"valid": valid, "compliant": valid, "diagnostics": diagnostics})
        );
    } else if valid {
        println!("compliant: {} manifest(s)", config.manifest_evidence.len());
    } else {
        for diagnostic in &diagnostics {
            eprintln!("{}: {}", diagnostic.code, diagnostic.message);
        }
    }
    if valid {
        Ok(())
    } else {
        bail!("project is not compliant")
    }
}

fn find<'a>(
    snapshot: &'a serde_json::Value,
    collection: &str,
    id: &str,
) -> Option<&'a serde_json::Value> {
    snapshot
        .get(collection)?
        .as_array()?
        .iter()
        .find(|item| item.get("id").and_then(serde_json::Value::as_str) == Some(id))
}

fn parse_manifest(path: &Path) -> Result<()> {
    let contents = fs::read_to_string(path).context("read manifest")?;
    if contents.trim().is_empty() {
        bail!("manifest is empty");
    }
    if path.extension().and_then(|extension| extension.to_str()) == Some("json") {
        let _: serde_json::Value =
            serde_json::from_str(&contents).context("manifest JSON is invalid")?;
    }
    Ok(())
}

async fn sync(payload: &Path) -> Result<()> {
    let endpoint =
        std::env::var("SIBYL_SYNC_ENDPOINT").context("SIBYL_SYNC_ENDPOINT is required")?;
    let token =
        std::env::var("SIBYL_SYNC_AUTH_TOKEN").context("SIBYL_SYNC_AUTH_TOKEN is required")?;
    if token.is_empty() || !endpoint.starts_with("https://") {
        bail!("sync endpoint and authorization are invalid");
    }
    let body = fs::read_to_string(payload).context("read sync payload")?;
    validate_sync_payload(&body)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    for attempt in 0..3 {
        let response = match client
            .post(&endpoint)
            .bearer_auth(&token)
            .body(body.clone())
            .send()
            .await
        {
            Ok(response) => response,
            Err(_) if attempt < 2 => continue,
            Err(_) => bail!("remote synchronization transport failed after bounded retries"),
        };
        if !response.status().is_success() {
            bail!(
                "remote synchronization failed with status {}",
                response.status()
            );
        }
        println!("remote acknowledgement received");
        return Ok(());
    }
    bail!("remote synchronization did not complete")
}

fn validate_sync_payload(body: &str) -> Result<()> {
    let value: serde_json::Value =
        serde_json::from_str(body).context("sync payload is not JSON")?;
    if value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_str)
        != Some("1.0")
    {
        bail!("sync payload schema version is unsupported");
    }
    let kind = value
        .get("kind")
        .and_then(serde_json::Value::as_str)
        .context("sync payload kind is required")?;
    if !matches!(kind, "episodic-memory" | "ast-skeleton") {
        bail!("sync payload kind is unsupported");
    }
    let serialized = body.to_ascii_lowercase();
    if serialized.contains("private key")
        || serialized.contains("\"token\"")
        || serialized.contains("\"password\"")
        || serialized.contains("\"secret\"")
    {
        bail!("sync payload contains prohibited secret material");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{check, init, manifest_evidence, validate_sync_payload};
    use std::fs;
    #[test]
    fn sync_payload_requires_supported_contract() {
        assert!(validate_sync_payload(
            r#"{"schemaVersion":"1.0","kind":"ast-skeleton","entries":[]}"#
        )
        .is_ok());
        assert!(validate_sync_payload(r#"{"schemaVersion":"2.0","kind":"ast-skeleton"}"#).is_err());
        assert!(validate_sync_payload(
            r#"{"schemaVersion":"1.0","kind":"ast-skeleton","token":"redacted"}"#
        )
        .is_err());
    }
    #[test]
    fn manifest_evidence_is_derived_without_executing_manifests() {
        let evidence = manifest_evidence(std::path::Path::new("."));
        assert!(evidence
            .iter()
            .all(|item| item.runtime_id.starts_with("runtime-")));
    }

    #[test]
    fn init_and_check_use_local_manifest_evidence_only() {
        let root = std::env::temp_dir().join(format!("sibyl-cli-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("temporary project");
        fs::write(root.join("package.json"), r#"{"name":"fixture"}"#).expect("package manifest");
        fs::write(root.join("pnpm-lock.yaml"), "lockfileVersion: '9.0'\n").expect("lockfile");
        init(&root, false).expect("initialization");
        assert!(check(&root, true).is_ok());
        assert!(init(&root, false).is_err());
        init(&root, true).expect("forced initialization");
        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn check_reports_malformed_and_unsupported_governance_metadata() {
        let root = std::env::temp_dir().join(format!("sibyl-cli-invalid-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join(".agent")).expect("temporary project");
        fs::write(root.join(".agent/config.json"), "{\"unexpected\":true}")
            .expect("malformed config");
        assert!(check(&root, true).is_err());
        fs::write(root.join(".agent/config.json"), r#"{"schemaVersion":"9.9","project":"fixture","mode":"declarative","runtimeOwners":{},"safeCommands":["sibyl check --json"],"manifestEvidence":[],"invariantIds":[],"remoteMutationRequiresExplicitCommand":true,"remoteEvidenceIsSeparate":true}"#).expect("unsupported config");
        assert!(check(&root, true).is_err());
        fs::remove_dir_all(&root).expect("cleanup");
    }
}
