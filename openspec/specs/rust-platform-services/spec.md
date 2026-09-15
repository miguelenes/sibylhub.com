# rust-platform-services Specification

## Purpose

Provide independently runnable Rust API and workstation CLI contracts for health, ecosystem access, invariant validation, local project analysis, and explicitly authorized edge synchronization.

## Requirements

### Requirement: The backend exposes a stable readiness contract

The backend SHALL start from a documented Cargo/Turborepo command, SHALL expose `GET /healthz`, and SHALL return a successful machine-readable JSON response with a stable readiness status when valid local configuration is loaded.

#### Scenario: The backend is ready
- **WHEN** the backend starts with valid local configuration and `GET /healthz` is requested
- **THEN** it returns a successful status and the documented JSON readiness shape

#### Scenario: Backend configuration is invalid
- **WHEN** a required configuration value is missing or invalid at startup
- **THEN** the process exits non-zero with an actionable diagnostic, does not panic, and does not print the invalid secret value

### Requirement: Ecosystem and invariant API behavior is explicit

The backend SHALL expose `GET /v1/ecosystems` through a documented JSON response contract backed by shared schema identities, SHALL expose stack-invariant validation through a documented request/response contract, and SHALL distinguish client validation failures from internal failures.

#### Scenario: Ecosystem metadata is requested
- **WHEN** a client requests `GET /v1/ecosystems` with valid configuration
- **THEN** the backend returns a successful schema-identifiable response containing the available ecosystem metadata or an explicitly documented empty result

#### Scenario: A request fails validation
- **WHEN** a client submits malformed or invariant-violating input
- **THEN** the backend returns the documented client-error status and structured error body without terminating the server

### Requirement: Rust failures and logs are typed and secret-safe

The backend and CLI SHALL use explicit typed error outcomes at their public boundaries, SHALL serialize stable error codes/messages for clients and operators, SHALL use structured logs, and SHALL exclude credentials, private keys, and raw secret-bearing provider responses from logs and diagnostics.

#### Scenario: An internal failure occurs
- **WHEN** a backend operation fails outside client input validation
- **THEN** the client receives the documented internal-error shape while structured logs contain a safe correlation/context record without secret material

### Requirement: The CLI is independently executable and non-mutating by default

The CLI SHALL be a separate executable with documented `--help` and version behavior, SHALL return non-zero for invalid commands or required configuration, and SHALL not perform network or state-changing work merely because it is bootstrapped or queried for help.

#### Scenario: CLI help and version are requested
- **WHEN** an operator runs `sibyl --help` or the documented version command
- **THEN** the CLI exits successfully and prints supported commands, configuration inputs, and version information

#### Scenario: CLI invocation is invalid
- **WHEN** an operator supplies an unknown command or invalid required input
- **THEN** the CLI exits non-zero with a concise safe diagnostic and performs no network or state-changing operation

### Requirement: `sibyl init` creates governed local project metadata

The CLI SHALL provide `sibyl init`, SHALL inspect supported local repository manifests without executing project code, SHALL generate a valid `.agent/` configuration from detected metadata, and SHALL report conflicts or an existing incompatible configuration before overwriting it.

#### Scenario: A project is initialized
- **WHEN** an operator runs `sibyl init` in a repository containing supported manifests
- **THEN** the CLI writes schema-valid `.agent/` metadata describing detected stacks and reports the files created

#### Scenario: Initialization encounters an existing incompatible configuration
- **WHEN** `sibyl init` finds existing `.agent/` content that conflicts with detected metadata
- **THEN** it exits non-zero or requests an explicit documented overwrite mode and does not silently discard existing governance data

### Requirement: `sibyl check` validates stack invariants without mutation

The CLI SHALL provide `sibyl check`, SHALL compare detected or installed package metadata against the selected stack invariants and shared schemas, SHALL report every violation with stable diagnostics, and SHALL return non-zero when the project is not compliant.

#### Scenario: A project satisfies its invariants
- **WHEN** an operator runs `sibyl check` against a project whose detected dependencies and configuration satisfy the selected rules
- **THEN** the CLI exits successfully and reports a machine-readable compliant result

#### Scenario: A project violates an invariant
- **WHEN** an operator runs `sibyl check` against a project with a missing, incompatible, or disallowed dependency/configuration
- **THEN** the CLI exits non-zero, identifies the violated invariant and evidence, and does not modify the project

### Requirement: `sibyl sync` uses explicit edge authorization and bounded effects

The CLI SHALL provide `sibyl sync` for episodic-memory and AST-skeleton synchronization, SHALL require an explicit configured endpoint and authorization mechanism, SHALL validate payloads against shared schemas before transmission, and SHALL report remote failures without exposing credentials or silently claiming convergence.

#### Scenario: A synchronization request is authorized
- **WHEN** an operator runs `sibyl sync` with valid local data, endpoint, authorization, and connectivity
- **THEN** the CLI validates the payload, performs the documented synchronization, and reports the remote revision or acknowledgement

#### Scenario: Synchronization prerequisites are absent
- **WHEN** the endpoint, authorization, payload validation, or remote service is unavailable
- **THEN** the CLI exits non-zero, identifies the failed prerequisite, performs no partial unreported mutation, and does not print secret values

### Requirement: Rust quality gates are reproducible offline

The Rust workspace SHALL expose format, Clippy, build, test, and supported coverage commands, SHALL commit its lockfile, and SHALL keep baseline tests runnable without provider credentials or unintended production network access.

#### Scenario: Rust validation runs offline
- **WHEN** an engineer runs the documented locked Rust validation commands without provider credentials
- **THEN** formatting, linting, compilation, and baseline tests validate the backend and CLI, while any explicitly external test is separately identified
