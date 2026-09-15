//! Axum service for health, versioned ecosystem snapshots, and invariant checks.

pub mod engine;
pub mod routes;
pub mod server;

pub use routes::router;
pub use server::{run, AppState, Config, ConfigError, Environment, ServerError};
