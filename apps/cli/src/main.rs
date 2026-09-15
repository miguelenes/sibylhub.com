use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use serde::Serialize;
use std::{
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

#[derive(Debug, Serialize)]
struct AgentConfig {
    schema_version: &'static str,
    project: String,
    mode: &'static str,
    detected_manifests: Vec<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    match Cli::parse().command {
        Commands::Init { path, force } => init(&path, force),
        Commands::Check { path, json } => check(&path, json),
        Commands::Sync { payload } => sync(&payload).await,
    }
}

fn manifests(path: &Path) -> Vec<String> {
    [
        "package.json",
        "pnpm-workspace.yaml",
        "Cargo.toml",
        "composer.json",
        "astro.config.ts",
        "docusaurus.config.ts",
    ]
    .iter()
    .filter(|name| path.join(name).is_file())
    .map(|name| (*name).to_owned())
    .collect()
}

fn init(path: &Path, force: bool) -> Result<()> {
    let agent = path.join(".agent");
    let config_path = agent.join("config.json");
    if config_path.exists() && !force {
        bail!(".agent/config.json already exists; pass --force after reviewing it")
    }
    fs::create_dir_all(&agent).context("create .agent directory")?;
    let config = AgentConfig {
        schema_version: "1.0",
        project: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("project")
            .to_owned(),
        mode: "declarative",
        detected_manifests: manifests(path),
    };
    fs::write(
        &config_path,
        format!("{}\n", serde_json::to_string_pretty(&config)?),
    )
    .context("write agent config")?;
    println!("created {}", config_path.display());
    Ok(())
}

fn check(path: &Path, json: bool) -> Result<()> {
    let detected = manifests(path);
    let compliant = !detected.is_empty();
    if json {
        println!(
            "{}",
            serde_json::json!({"valid": compliant, "diagnostics": if compliant { Vec::<String>::new() } else { vec!["no supported manifest found".to_owned()] }})
        );
    } else if compliant {
        println!("compliant: {}", detected.join(", "));
    } else {
        eprintln!("violation: no supported manifest found");
    }
    if compliant {
        Ok(())
    } else {
        bail!("project is not compliant")
    }
}

async fn sync(payload: &Path) -> Result<()> {
    let endpoint =
        std::env::var("SIBYL_SYNC_ENDPOINT").context("SIBYL_SYNC_ENDPOINT is required")?;
    let token =
        std::env::var("SIBYL_SYNC_AUTH_TOKEN").context("SIBYL_SYNC_AUTH_TOKEN is required")?;
    if token.is_empty() || !endpoint.starts_with("https://") {
        bail!("sync endpoint and authorization are invalid")
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
    let schema_version = value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_str)
        .context("sync payload schemaVersion is required")?;
    if schema_version != "1.0" {
        bail!("sync payload schema version is unsupported")
    }
    let kind = value
        .get("kind")
        .and_then(serde_json::Value::as_str)
        .context("sync payload kind is required")?;
    if !matches!(kind, "episodic-memory" | "ast-skeleton") {
        bail!("sync payload kind is unsupported")
    }
    let serialized = body.to_ascii_lowercase();
    if serialized.contains("private key")
        || serialized.contains("\"token\"")
        || serialized.contains("\"password\"")
        || serialized.contains("\"secret\"")
    {
        bail!("sync payload contains prohibited secret material")
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_sync_payload;

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
}
