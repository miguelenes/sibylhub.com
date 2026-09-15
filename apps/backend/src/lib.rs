//! Axum service for health, versioned ecosystem snapshots, and invariant checks.

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, env, net::SocketAddr, path::PathBuf, sync::Arc};
use thiserror::Error;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

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
pub struct InvariantRequest {
    pub language_id: String,
    pub invariant_id: String,
    pub compliant: bool,
}

#[derive(Debug, Serialize)]
pub struct InvariantResponse {
    pub valid: bool,
    pub language_id: String,
    pub invariant_id: String,
    pub diagnostic: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub code: &'static str,
    pub message: &'static str,
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

async fn validate_invariant(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InvariantRequest>,
) -> impl IntoResponse {
    if request.language_id.trim().is_empty() || request.invariant_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                code: "invalid_request",
                message: "language_id and invariant_id are required",
            }),
        )
            .into_response();
    }
    let language_exists = state
        .snapshot
        .get("languages")
        .and_then(serde_json::Value::as_array)
        .is_some_and(|languages| {
            languages.iter().any(|language| {
                language.get("id").and_then(serde_json::Value::as_str)
                    == Some(request.language_id.as_str())
            })
        });
    let invariant_exists = state
        .snapshot
        .get("invariants")
        .and_then(serde_json::Value::as_array)
        .is_some_and(|invariants| {
            invariants.iter().any(|invariant| {
                invariant.get("id").and_then(serde_json::Value::as_str)
                    == Some(request.invariant_id.as_str())
            })
        });
    if !language_exists || !invariant_exists {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ErrorResponse {
                code: "unresolved_reference",
                message: "language_id or invariant_id is not present in the registry snapshot",
            }),
        )
            .into_response();
    }
    if !request.compliant {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(InvariantResponse {
                valid: false,
                language_id: request.language_id,
                invariant_id: request.invariant_id,
                diagnostic: Some("invariant violation".to_owned()),
            }),
        )
            .into_response();
    }
    (
        StatusCode::OK,
        Json(InvariantResponse {
            valid: true,
            language_id: request.language_id,
            invariant_id: request.invariant_id,
            diagnostic: None,
        }),
    )
        .into_response()
}

pub fn snapshot_from_config(config: &Config) -> Result<serde_json::Value, anyhow::Error> {
    let path = config
        .snapshot_path
        .as_deref()
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../packages/schemas/fixtures/valid-ecosystem.json")
        });
    if !path.exists() {
        anyhow::bail!("registry snapshot is missing; build packages/schemas first");
    }
    let contents = std::fs::read_to_string(&path)?;
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
    if languages.len() != 25 {
        anyhow::bail!("registry snapshot must contain exactly 25 languages");
    }
    let ids = |key: &str| -> Result<HashSet<&str>, anyhow::Error> {
        let entries = value
            .get(key)
            .and_then(serde_json::Value::as_array)
            .ok_or_else(|| anyhow::anyhow!("registry snapshot {key} must be an array"))?;
        Ok(entries
            .iter()
            .filter_map(|entry| entry.get("id").and_then(serde_json::Value::as_str))
            .collect())
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
    use axum::{body::Body, http::Request};
    use tower::util::ServiceExt;

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

    #[test]
    fn invalid_snapshot_is_rejected() {
        let error = validate_snapshot(
            &serde_json::json!({"schemaVersion":"1.0", "languages": []}),
            "1.0",
        )
        .expect_err("incomplete snapshots must fail closed");
        assert!(error.to_string().contains("25 languages"));
    }
}
