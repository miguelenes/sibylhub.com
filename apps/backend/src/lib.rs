//! Axum service for health, versioned ecosystem snapshots, and invariant checks.

use axum::{
    extract::{rejection::JsonRejection, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};
use thiserror::Error;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

const EXPECTED_LANGUAGES: [&str; 25] = [
    "c",
    "cpp",
    "csharp",
    "dart",
    "elixir",
    "go",
    "haskell",
    "java",
    "javascript",
    "kotlin",
    "lua",
    "objective-c",
    "perl",
    "php",
    "python",
    "r",
    "ruby",
    "rust",
    "scala",
    "swift",
    "typescript",
    "zig",
    "shell",
    "powershell",
    "sql",
];

#[derive(Debug, Clone)]
pub struct Config {
    pub bind: SocketAddr,
    pub schema_version: String,
    pub snapshot_path: Option<String>,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("invalid SIBYL_BIND address")]
    InvalidBind(#[from] std::net::AddrParseError),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let bind = env::var("SIBYL_BIND")
            .unwrap_or_else(|_| "127.0.0.1:8787".to_owned())
            .parse()?;
        Ok(Self {
            bind,
            schema_version: env::var("SIBYL_SCHEMA_VERSION").unwrap_or_else(|_| "1.0".to_owned()),
            snapshot_path: env::var("SIBYL_REGISTRY_SNAPSHOT")
                .ok()
                .filter(|value| !value.trim().is_empty()),
        })
    }
}

#[derive(Debug, Clone)]
pub struct AppState {
    pub schema_version: String,
    pub snapshot: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub schema_version: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvariantRequest {
    pub language_id: String,
    pub invariant_id: String,
    pub evidence: InvariantEvidence,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvariantEvidence {
    pub runtime_id: String,
    pub lockfile_id: String,
    pub manifest_paths: Vec<String>,
    #[serde(default)]
    pub package_manager_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Diagnostic {
    pub code: &'static str,
    pub message: String,
    pub field: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InvariantResponse {
    pub valid: bool,
    pub language_id: String,
    pub invariant_id: String,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub code: &'static str,
    pub message: &'static str,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/ecosystems", get(ecosystems))
        .route("/v1/invariants/validate", post(validate_invariant))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(Arc::new(state))
}

async fn healthz(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ready",
        schema_version: state.schema_version.clone(),
    })
}

async fn ecosystems(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(state.snapshot.clone())
}

fn bad_request(code: &'static str, message: &'static str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse {
            code,
            message,
            diagnostics: Vec::new(),
        }),
    )
        .into_response()
}

async fn validate_invariant(
    State(state): State<Arc<AppState>>,
    request: Result<Json<serde_json::Value>, JsonRejection>,
) -> Response {
    let Json(raw) = match request {
        Ok(value) => value,
        Err(_) => return bad_request("malformed_json", "request body must be valid JSON"),
    };
    if raw.get("compliant").is_some() {
        return bad_request(
            "legacy_compliance_assertion",
            "compliance assertions are not evidence",
        );
    }
    let request: InvariantRequest = match serde_json::from_value(raw) {
        Ok(value) => value,
        Err(_) => {
            return bad_request(
                "invalid_request",
                "language, invariant, and evidence are required",
            )
        }
    };
    if request.language_id.trim().is_empty() || request.invariant_id.trim().is_empty() {
        return bad_request(
            "invalid_request",
            "language_id and invariant_id are required",
        );
    }

    let Some(language) = find_entry(&state.snapshot, "languages", &request.language_id) else {
        return bad_request(
            "unknown_language",
            "language_id is not present in the registry snapshot",
        );
    };
    let Some(invariant) = find_entry(&state.snapshot, "invariants", &request.invariant_id) else {
        return bad_request(
            "unknown_invariant",
            "invariant_id is not present in the registry snapshot",
        );
    };
    if invariant
        .get("languageId")
        .and_then(serde_json::Value::as_str)
        != Some(request.language_id.as_str())
        || !language_has_invariant(language, &request.invariant_id)
    {
        return bad_request(
            "unresolved_relationship",
            "the invariant is not associated with the requested language",
        );
    }
    if invariant.get("rule").and_then(serde_json::Value::as_str)
        != Some("declared-runtime-and-lockfile")
    {
        return bad_request(
            "unsupported_rule",
            "the registry rule is not supported by this service",
        );
    }

    let diagnostics = evaluate_evidence(language, invariant, &request.evidence);
    let response = InvariantResponse {
        valid: diagnostics.is_empty(),
        language_id: request.language_id,
        invariant_id: request.invariant_id,
        diagnostics,
    };
    if response.valid {
        (StatusCode::OK, Json(response)).into_response()
    } else {
        (StatusCode::UNPROCESSABLE_ENTITY, Json(response)).into_response()
    }
}

fn find_entry<'a>(
    snapshot: &'a serde_json::Value,
    collection: &str,
    id: &str,
) -> Option<&'a serde_json::Value> {
    snapshot
        .get(collection)
        .and_then(serde_json::Value::as_array)
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("id").and_then(serde_json::Value::as_str) == Some(id))
        })
}

fn language_has_invariant(language: &serde_json::Value, invariant_id: &str) -> bool {
    language
        .get("invariantIds")
        .and_then(serde_json::Value::as_array)
        .is_some_and(|items| items.iter().any(|item| item.as_str() == Some(invariant_id)))
}

fn evaluate_evidence(
    language: &serde_json::Value,
    invariant: &serde_json::Value,
    evidence: &InvariantEvidence,
) -> Vec<Diagnostic> {
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
    let mut diagnostics = Vec::new();
    if fields.contains(&"runtimeId")
        && language
            .get("runtimeId")
            .and_then(serde_json::Value::as_str)
            != Some(evidence.runtime_id.as_str())
    {
        diagnostics.push(Diagnostic {
            code: "runtime_mismatch",
            message: "runtime evidence does not match the registry language relationship"
                .to_owned(),
            field: Some("evidence.runtime_id".to_owned()),
        });
    }
    if fields.contains(&"lockfileId")
        && language
            .get("lockfileId")
            .and_then(serde_json::Value::as_str)
            != Some(evidence.lockfile_id.as_str())
    {
        diagnostics.push(Diagnostic {
            code: "lockfile_mismatch",
            message: "lockfile evidence does not match the registry language relationship"
                .to_owned(),
            field: Some("evidence.lockfile_id".to_owned()),
        });
    }
    if fields.contains(&"manifestPaths")
        && evidence
            .manifest_paths
            .iter()
            .all(|path| path.trim().is_empty())
    {
        diagnostics.push(Diagnostic {
            code: "manifest_missing",
            message: "manifest evidence must contain a non-empty path".to_owned(),
            field: Some("evidence.manifest_paths".to_owned()),
        });
    }
    if fields.contains(&"packageManagerId")
        && language
            .get("packageManagerId")
            .and_then(serde_json::Value::as_str)
            != evidence.package_manager_id.as_deref()
    {
        diagnostics.push(Diagnostic {
            code: "package_manager_mismatch",
            message: "package-manager evidence does not match the registry language relationship"
                .to_owned(),
            field: Some("evidence.package_manager_id".to_owned()),
        });
    }
    diagnostics
}

pub fn snapshot_from_config(config: &Config) -> Result<serde_json::Value, anyhow::Error> {
    let Some(snapshot) = config.snapshot_path.as_deref() else {
        return Ok(serde_json::json!({
            "schemaVersion": config.schema_version,
            "languages": [],
            "runtimes": [],
            "packageManagers": [],
            "lockfiles": [],
            "builders": [],
            "invariants": [],
            "documentation": []
        }));
    };
    let path = PathBuf::from(snapshot);
    if !path.exists() {
        anyhow::bail!("registry snapshot is missing; build packages/schemas first");
    }
    let contents = std::fs::read_to_string(path)?;
    let value: serde_json::Value = serde_json::from_str(&contents)?;
    validate_snapshot(&value, &config.schema_version)?;
    Ok(value)
}

pub fn validate_snapshot(
    value: &serde_json::Value,
    schema_version: &str,
) -> Result<(), anyhow::Error> {
    if value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_str)
        != Some(schema_version)
    {
        anyhow::bail!("registry schema version is unsupported");
    }
    let languages = value
        .get("languages")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| anyhow::anyhow!("registry snapshot languages must be an array"))?;
    if languages.len() != EXPECTED_LANGUAGES.len() {
        anyhow::bail!("registry snapshot must contain exactly 25 languages");
    }
    for expected in EXPECTED_LANGUAGES {
        if languages
            .iter()
            .filter(|language| {
                language.get("id").and_then(serde_json::Value::as_str) == Some(expected)
            })
            .count()
            != 1
        {
            anyhow::bail!("registry snapshot language identities are incomplete or duplicated");
        }
    }
    let ids = |key: &str| -> Result<std::collections::HashSet<&str>, anyhow::Error> {
        let entries = value
            .get(key)
            .and_then(serde_json::Value::as_array)
            .ok_or_else(|| anyhow::anyhow!("registry snapshot {key} must be an array"))?;
        if entries.len() != EXPECTED_LANGUAGES.len() {
            anyhow::bail!("registry snapshot {key} must contain exactly 25 entries");
        }
        let ids = entries
            .iter()
            .filter_map(|entry| entry.get("id").and_then(serde_json::Value::as_str))
            .collect::<std::collections::HashSet<_>>();
        if ids.len() != entries.len() {
            anyhow::bail!("registry snapshot {key} contains duplicate identifiers");
        }
        Ok(ids)
    };
    let runtimes = ids("runtimes")?;
    let package_managers = ids("packageManagers")?;
    let lockfiles = ids("lockfiles")?;
    let builders = ids("builders")?;
    let invariants = ids("invariants")?;
    let documentation = ids("documentation")?;
    for language in languages {
        for (key, catalog) in [
            ("runtimeId", &runtimes),
            ("packageManagerId", &package_managers),
            ("lockfileId", &lockfiles),
            ("builderId", &builders),
            ("documentationId", &documentation),
        ] {
            let Some(reference) = language.get(key).and_then(serde_json::Value::as_str) else {
                anyhow::bail!("language relationship {key} is missing");
            };
            if !catalog.contains(reference) {
                anyhow::bail!("language relationship {key} is unresolved");
            }
        }
        let invariant_ids = language
            .get("invariantIds")
            .and_then(serde_json::Value::as_array)
            .ok_or_else(|| anyhow::anyhow!("language invariantIds is missing"))?;
        for invariant in invariant_ids {
            let Some(invariant) = invariant.as_str() else {
                anyhow::bail!("language invariant reference is invalid");
            };
            if !invariants.contains(invariant) {
                anyhow::bail!("language invariant relationship is unresolved");
            }
        }
    }
    for invariant in value
        .get("invariants")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
    {
        let Some(language_id) = invariant
            .get("languageId")
            .and_then(serde_json::Value::as_str)
        else {
            anyhow::bail!("invariant languageId is missing");
        };
        if !EXPECTED_LANGUAGES.contains(&language_id) {
            anyhow::bail!("invariant language relationship is unresolved");
        }
        if invariant
            .get("evidenceFields")
            .and_then(serde_json::Value::as_array)
            .is_none_or(Vec::is_empty)
        {
            anyhow::bail!("invariant evidenceFields is missing");
        }
    }
    Ok(())
}

pub async fn run(config: Config) -> anyhow::Result<()> {
    let snapshot = snapshot_from_config(&config)?;
    let listener = tokio::net::TcpListener::bind(config.bind).await?;
    tracing::info!(address = %config.bind, "backend ready");
    axum::serve(
        listener,
        router(AppState {
            schema_version: config.schema_version,
            snapshot,
        }),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    Ok(())
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{to_bytes, Body},
        http::{Request, StatusCode},
    };
    use tower::util::ServiceExt;

    fn fixture_state() -> AppState {
        AppState {
            schema_version: "1.0".to_owned(),
            snapshot: serde_json::from_str(include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../../packages/schemas/fixtures/valid-ecosystem.json"
            )))
            .expect("fixture"),
        }
    }

    #[tokio::test]
    async fn health_endpoint_returns_ready_json() {
        let response = router(AppState {
            schema_version: "1.0".to_owned(),
            snapshot: serde_json::json!({"schemaVersion":"1.0"}),
        })
        .oneshot(
            Request::get("/healthz")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn ecosystem_endpoint_returns_the_complete_snapshot() {
        let response = router(fixture_state())
            .oneshot(
                Request::get("/v1/ecosystems")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        assert!(String::from_utf8_lossy(&body).contains("\"languages\""));
    }

    #[test]
    fn invalid_snapshot_is_rejected() {
        let error = validate_snapshot(
            &serde_json::json!({"schemaVersion":"1.0", "languages": []}),
            "1.0",
        )
        .expect_err("incomplete snapshots must fail closed");
        assert!(error.to_string().contains("25 languages"));
    }

    #[test]
    fn generated_invalid_fixtures_are_rejected() {
        for fixture in [
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../../packages/schemas/fixtures/incomplete-ecosystem.json"
            )),
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../../packages/schemas/fixtures/incompatible-ecosystem.json"
            )),
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../../packages/schemas/fixtures/unresolved-ecosystem.json"
            )),
        ] {
            let snapshot = serde_json::from_str(fixture).expect("fixture JSON");
            assert!(validate_snapshot(&snapshot, "1.0").is_err());
        }
    }

    #[tokio::test]
    async fn invariant_validation_uses_registry_evidence() {
        let response = router(fixture_state())
            .oneshot(
                Request::post("/v1/invariants/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::json!({
                            "language_id": "typescript",
                            "invariant_id": "invariant-typescript",
                            "evidence": {
                                "runtime_id": "runtime-typescript",
                                "lockfile_id": "lockfile-typescript",
                                "manifest_paths": ["package.json"]
                            }
                        })
                        .to_string(),
                    ))
                    .expect("request"),
            )
            .await
            .expect("response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = router(fixture_state()).oneshot(
            Request::post("/v1/invariants/validate")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::json!({
                    "language_id": "typescript",
                    "invariant_id": "invariant-typescript",
                    "evidence": {"runtime_id": "runtime-rust", "lockfile_id": "lockfile-typescript", "manifest_paths": ["package.json"]}
                }).to_string())).expect("request"),
        ).await.expect("response");
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        assert!(String::from_utf8_lossy(&body).contains("runtime_mismatch"));
    }

    #[tokio::test]
    async fn malformed_and_legacy_requests_are_client_errors() {
        for body in [
            "not-json".to_owned(),
            serde_json::json!({"language_id":"typescript", "invariant_id":"invariant-typescript", "compliant":true}).to_string(),
        ] {
            let response = router(fixture_state()).oneshot(
                Request::post("/v1/invariants/validate").header("content-type", "application/json").body(Body::from(body)).expect("request"),
            ).await.expect("response");
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }
    }
}
