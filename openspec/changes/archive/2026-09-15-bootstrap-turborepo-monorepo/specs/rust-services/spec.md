## Purpose

Provide a Rust backend process with an HTTP API/webserver foundation and a separate Rust CLI that share explicit, testable configuration and error boundaries while remaining independently runnable.

## ADDED Requirements

### Requirement: The backend exposes a health contract

The backend SHALL start from a documented Cargo command, SHALL expose a local health endpoint for process checks, and SHALL return a stable machine-readable success response when the process is ready to accept requests.

#### Scenario: The backend is healthy
- **WHEN** the backend has started with valid local configuration and the health endpoint is requested
- **THEN** the response uses a successful HTTP status and a documented JSON shape indicating readiness

#### Scenario: The backend configuration is invalid
- **WHEN** the backend is started with a missing or invalid required configuration value
- **THEN** startup fails with a non-zero exit status and an actionable error without panicking or exposing secret values

### Requirement: API and webserver failures are explicit

The backend SHALL distinguish client-visible request errors from internal failures, SHALL serialize API errors through a documented response shape, and SHALL use structured logs without placing credentials or raw secret-bearing provider responses in output.

#### Scenario: A malformed API request is received
- **WHEN** a request fails input validation
- **THEN** the backend returns a documented client-error status and structured error body without terminating the server

### Requirement: The CLI is independently executable

The CLI SHALL be a separate Cargo application with documented `--help` and version behavior, SHALL return non-zero status for invalid invocation or configuration, and SHALL share only explicit stable interfaces with the backend/domain code.

#### Scenario: CLI help is requested
- **WHEN** an operator runs the CLI with `--help`
- **THEN** it exits successfully and prints the supported commands and configuration inputs

#### Scenario: CLI input is invalid
- **WHEN** an operator supplies an unknown command or invalid required input
- **THEN** the CLI exits non-zero with a concise diagnostic and does not perform a network or state-changing operation

### Requirement: Rust quality gates are reproducible

The Rust workspace SHALL commit its Cargo lockfile, expose formatting, linting, test, and build commands, and SHALL keep baseline tests runnable offline unless a test is explicitly classified as requiring an external service.

#### Scenario: Rust validation is run offline
- **WHEN** an engineer runs the documented Rust validation commands without provider credentials
- **THEN** formatting, Clippy, unit/integration tests, and compilation validate the scaffold without silently contacting a production service
