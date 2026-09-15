//! Runtime configuration, registry installation, and graceful server lifecycle.

use crate::{
    engine::{RegistryEngine, RegistryError},
    routes,
};
use std::{env, net::SocketAddr, sync::Arc};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Development,
    Production,
}

impl Environment {
    fn from_env(value: Option<String>) -> Result<Self, ConfigError> {
        match value.as_deref().unwrap_or("development") {
            "development" | "dev" => Ok(Self::Development),
            "production" | "prod" => Ok(Self::Production),
            _ => Err(ConfigError::InvalidEnvironment),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub bind: SocketAddr,
    pub schema_version: String,
    pub snapshot_path: Option<String>,
    pub registry_url: Option<String>,
    pub environment: Environment,
    pub log_filter: String,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("invalid SIBYL_BIND address")]
    InvalidBind(#[from] std::net::AddrParseError),
    #[error("SIBYL_SCHEMA_VERSION must be 1.0 or 2.0")]
    InvalidSchemaVersion,
    #[error("SIBYL_ENV must be development or production")]
    InvalidEnvironment,
    #[error("SIBYL_REGISTRY_URL must be an HTTPS URL without credentials")]
    InvalidRegistryUrl,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_values(
            env::var("SIBYL_BIND").ok(),
            env::var("SIBYL_SCHEMA_VERSION").ok(),
            optional_env("SIBYL_REGISTRY_SNAPSHOT"),
            optional_env("SIBYL_REGISTRY_URL"),
            env::var("SIBYL_ENV").ok(),
            env::var("RUST_LOG").ok(),
        )
    }

    fn from_values(
        bind: Option<String>,
        schema_version: Option<String>,
        snapshot_path: Option<String>,
        registry_url: Option<String>,
        environment: Option<String>,
        log_filter: Option<String>,
    ) -> Result<Self, ConfigError> {
        let bind = bind.unwrap_or_else(|| "0.0.0.0:8080".to_owned()).parse()?;
        let schema_version = schema_version.unwrap_or_else(|| "2.0".to_owned());
        if !matches!(schema_version.as_str(), "1.0" | "2.0") {
            return Err(ConfigError::InvalidSchemaVersion);
        }
        if let Some(url) = registry_url.as_deref() {
            let parsed = reqwest::Url::parse(url).map_err(|_| ConfigError::InvalidRegistryUrl)?;
            if parsed.scheme() != "https" || parsed.username() != "" || parsed.password().is_some()
            {
                return Err(ConfigError::InvalidRegistryUrl);
            }
        }
        Ok(Self {
            bind,
            schema_version,
            snapshot_path,
            registry_url,
            environment: Environment::from_env(environment)?,
            log_filter: log_filter
                .unwrap_or_else(|| "sibyl_backend=info,tower_http=info".to_owned()),
        })
    }
}

fn optional_env(name: &str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

#[derive(Clone)]
pub struct AppState {
    pub schema_version: String,
    pub registry: Arc<RegistryEngine>,
}

impl AppState {
    pub fn new(registry: RegistryEngine) -> Self {
        let schema_version = registry.schema_version.clone();
        Self {
            schema_version,
            registry: Arc::new(registry),
        }
    }
}

#[derive(Debug, Error)]
pub enum ServerError {
    #[error("registry could not be loaded: {0}")]
    Registry(#[from] RegistryError),
    #[error("backend could not bind to the configured address")]
    Bind(#[source] std::io::Error),
    #[error("backend server failed")]
    Serve(#[source] std::io::Error),
    #[error("backend shutdown signal handler could not be installed")]
    Shutdown(#[source] std::io::Error),
}

pub async fn run(config: Config) -> Result<(), ServerError> {
    let registry = load_registry(&config).await?;
    let listener = tokio::net::TcpListener::bind(config.bind)
        .await
        .map_err(ServerError::Bind)?;
    tracing::info!(address = %config.bind, schema_version = %registry.schema_version, "backend ready");
    axum::serve(listener, routes::router(AppState::new(registry)))
        .with_graceful_shutdown(shutdown_signal()?)
        .await
        .map_err(ServerError::Serve)
}

async fn load_registry(config: &Config) -> Result<RegistryEngine, RegistryError> {
    if let Some(path) = config.snapshot_path.as_deref() {
        return RegistryEngine::from_local_path(path, &config.schema_version);
    }
    if let Some(url) = config.registry_url.as_deref() {
        return RegistryEngine::from_remote_url(url, &config.schema_version).await;
    }
    Ok(RegistryEngine::empty(config.schema_version.clone()))
}

fn shutdown_signal() -> Result<impl std::future::Future<Output = ()> + Send + 'static, ServerError>
{
    #[cfg(unix)]
    {
        let mut interrupt =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())
                .map_err(ServerError::Shutdown)?;
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .map_err(ServerError::Shutdown)?;
        Ok(async move {
            tokio::select! {
                _ = interrupt.recv() => tracing::info!("received SIGINT; shutting down"),
                _ = terminate.recv() => tracing::info!("received SIGTERM; shutting down"),
            }
        })
    }
    #[cfg(not(unix))]
    {
        Ok(async {
            if let Err(error) = tokio::signal::ctrl_c().await {
                tracing::error!(error = %error, "shutdown signal listener failed");
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_the_public_backend_bind() {
        let config =
            Config::from_values(None, None, None, None, None, None).expect("defaults are valid");
        assert_eq!(config.bind.to_string(), "0.0.0.0:8080");
        assert_eq!(config.schema_version, "2.0");
        assert_eq!(config.environment, Environment::Development);
    }

    #[test]
    fn configuration_rejects_invalid_values_without_echoing_them() {
        let error = Config::from_values(
            Some("not-an-address".to_owned()),
            Some("3.0".to_owned()),
            None,
            Some("http://user:secret@example.invalid/export".to_owned()),
            Some("staging".to_owned()),
            None,
        )
        .expect_err("invalid bind must fail");
        assert!(!error.to_string().contains("secret"));

        let error = Config::from_values(None, Some("3.0".to_owned()), None, None, None, None)
            .expect_err("unsupported schema must fail");
        assert_eq!(error.to_string(), "SIBYL_SCHEMA_VERSION must be 1.0 or 2.0");

        let error = Config::from_values(None, None, None, None, Some("staging".to_owned()), None)
            .expect_err("unsupported environment must fail");
        assert_eq!(
            error.to_string(),
            "SIBYL_ENV must be development or production"
        );

        let error = Config::from_values(
            None,
            None,
            None,
            Some("http://example.invalid/export".to_owned()),
            None,
            None,
        )
        .expect_err("non-HTTPS registry sources must fail");
        assert_eq!(
            error.to_string(),
            "SIBYL_REGISTRY_URL must be an HTTPS URL without credentials"
        );
    }
}
