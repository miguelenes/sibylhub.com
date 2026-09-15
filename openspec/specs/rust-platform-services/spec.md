# rust-platform-services Specification

## Purpose

Provide independently runnable Rust API and workstation CLI contracts for health, ecosystem access, invariant validation, local project analysis, and explicitly authorized edge synchronization.

## Requirements

### Requirement: The backend exposes a stable readiness contract

The backend SHALL start from a documented Cargo/Turborepo command, SHALL expose `GET /healthz`, and SHALL return a successful machine-readable JSON response with `status` set to `ok`, backend `version` set to `0.1.0`, and an RFC 3339 UTC `timestamp` when valid local configuration is loaded. The default listening address SHALL be `0.0.0.0:8080` and SHALL be overrideable through the documented environment configuration.

#### Scenario: The backend is ready
- **WHEN** the backend starts with valid local configuration and `GET /healthz` is requested
- **THEN** it returns HTTP 200 JSON containing `status: "ok"`, `version: "0.1.0"`, and a parseable RFC 3339 UTC `timestamp`

#### Scenario: Backend configuration is invalid
- **WHEN** a required configuration value is missing or invalid at startup
- **THEN** the process exits non-zero with an actionable diagnostic, does not panic, and does not print the invalid secret value

### Requirement: Ecosystem and invariant API behavior is explicit

The backend SHALL expose `GET /v1/ecosystems` through a documented JSON response contract backed by shared schema identities, SHALL return active programming language identities, detected manifest metadata, and default package managers, SHALL expose stack-invariant validation through the documented `POST /v1/invariants/validate` request/response contract, and SHALL distinguish client validation failures from internal failures. Invariant validation SHALL require structured project evidence, SHALL evaluate that evidence against the selected language and invariant in the loaded registry snapshot, and SHALL reject a request that provides only a legacy client-supplied compliance assertion. A client-supplied compliance result SHALL NOT determine the response. The backend SHALL additionally expose `POST /v1/invariants/check`, which SHALL validate a requested ecosystem and runtime against dependency identifiers and return a deterministic package-policy result without treating a caller-provided result as evidence.

#### Scenario: Ecosystem metadata is requested
- **WHEN** a client requests `GET /v1/ecosystems` with valid configuration
- **THEN** the backend returns HTTP 200 JSON containing schema-identifiable active languages, detected manifests, and default package managers, or an explicitly documented empty result when no registry snapshot is configured

#### Scenario: A request fails validation
- **WHEN** a client submits malformed or invariant-violating input
- **THEN** the backend returns the documented client-error status and structured error body without terminating the server

#### Scenario: A legacy compliance assertion is submitted
- **WHEN** a client submits `compliant` without the structured evidence required by the selected invariant
- **THEN** the backend returns a stable structured client-validation error and does not treat the assertion as proof

#### Scenario: Evidence satisfies a selected invariant
- **WHEN** a client submits a known language, a known invariant associated with that language, and evidence satisfying the invariant rule
- **THEN** the backend returns a successful valid result derived from the evidence and registry snapshot

#### Scenario: Evidence violates a selected invariant
- **WHEN** a client submits a known language and invariant with missing, incompatible, or disallowed evidence
- **THEN** the backend returns a structured invalid result with stable diagnostics and does not accept a caller-provided compliance assertion as proof

#### Scenario: No dependency violates the requested package policy
- **WHEN** a client submits a valid ecosystem, runtime, and dependency map to `POST /v1/invariants/check` and none of the dependency identifiers are banned for that runtime
- **THEN** the backend returns HTTP 200 with `compliant: true` and an empty `violations` array

#### Scenario: A dependency violates the requested package policy
- **WHEN** a client submits a valid ecosystem, runtime, and dependency map containing a banned package identifier
- **THEN** the backend returns HTTP 200 with `compliant: false` and a violation for each matched package containing `package`, `severity`, `approved_replacement`, and `reason`

#### Scenario: A package-policy request is malformed or unresolved
- **WHEN** a client submits malformed dependencies, unknown ecosystem/runtime identities, or an unknown request field to `POST /v1/invariants/check`
- **THEN** the backend returns HTTP 400 with a structured client-validation error and does not claim compliance

### Requirement: The backend serves a validated versioned registry cache

The backend SHALL load registry data from an explicitly configured public export or an explicitly configured local snapshot, SHALL validate the declared supported schema version, snapshot identity, language artifacts, stable identifiers, and required relationships before installing the cache, and SHALL use an explicitly documented empty offline result when no source is configured. A configured but unreadable, malformed, unsupported, or internally inconsistent source SHALL prevent startup rather than being silently accepted. Package-policy evaluation SHALL use an in-memory index keyed by normalized package identifiers and SHALL not scan the complete registry on every request.

#### Scenario: A valid local registry snapshot is configured
- **WHEN** the backend starts with a readable local snapshot that passes the supported registry validation
- **THEN** it installs the snapshot and serves ecosystem metadata, evidence validation, and package-policy checks from that snapshot

#### Scenario: A public registry export is configured
- **WHEN** the backend starts with an explicitly configured public registry export and the export plus its referenced artifacts are reachable and valid
- **THEN** it installs the validated export and serves requests without requiring access to Laravel tables or another application database

#### Scenario: No registry source is configured
- **WHEN** the backend starts without a registry URL or local snapshot path
- **THEN** it starts with the documented empty ecosystem result and package-policy checks return no policy violations unless a separately loaded policy is available

#### Scenario: A registry source declares an unsupported or invalid artifact set
- **WHEN** the configured source declares an unsupported schema version, mismatched snapshot identity, missing language artifact, unresolved relationship, or malformed JSON
- **THEN** startup exits non-zero with a safe actionable diagnostic and the invalid artifact set is not served

### Requirement: The backend calculates deterministic context budgets

The backend SHALL expose `POST /v1/context/budget`, SHALL accept a JSON request containing a positive integer `context_ceiling_tokens`, and SHALL return deterministic integer partitions for Rules at 10%, Memories at 15%, AST Skeletons at 35%, Active Files at 30%, and Tools at 10%. The returned partitions SHALL sum exactly to the requested ceiling. Invalid JSON, missing or zero ceilings, non-integer ceilings, and unknown request fields SHALL return a structured HTTP 400 client-validation error.

#### Scenario: A 128000-token context ceiling is requested
- **WHEN** a client posts `{ "context_ceiling_tokens": 128000 }`
- **THEN** the backend returns HTTP 200 with partitions of Rules `12800`, Memories `19200`, AST Skeletons `44800`, Active Files `38400`, and Tools `12800`, whose sum is `128000`

#### Scenario: A ceiling requires integer rounding
- **WHEN** a client submits a positive ceiling whose percentage partitions are fractional token counts
- **THEN** the backend applies one documented deterministic rounding rule, returns integer partitions, and preserves an exact total equal to the requested ceiling

#### Scenario: A context-budget request is invalid
- **WHEN** a client submits a missing, zero, negative, non-integer, malformed, or unknown-field ceiling request
- **THEN** the backend returns HTTP 400 with a structured client-validation error and does not return a partial budget

### Requirement: Backend observability and shutdown are environment-aware

The backend SHALL emit structured tracing records with secret-safe fields, SHALL use JSON formatting when the documented runtime environment is production and ANSI-formatted human-readable output in development, SHALL honor the configured log filter, and SHALL complete graceful shutdown on SIGINT or SIGTERM after allowing in-flight requests to finish within the documented timeout.

#### Scenario: Production logging is enabled
- **WHEN** the backend starts with the production environment setting and handles a request
- **THEN** its emitted application records use machine-readable JSON and omit credentials, private keys, and raw secret-bearing provider responses

#### Scenario: Development logging is enabled
- **WHEN** the backend starts with the development environment setting and handles a request
- **THEN** its emitted application records use the documented ANSI-capable development format and remain secret-safe

#### Scenario: A termination signal is received
- **WHEN** the running backend receives SIGINT or SIGTERM
- **THEN** it stops accepting new work, allows bounded in-flight work to complete, and exits successfully without an uncontrolled panic

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

The CLI SHALL provide `sibyl init`, SHALL inspect `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, and `composer.json` when present without executing project code, SHALL detect the associated language/runtime, package manager, and available lockfile evidence, and SHALL generate schema-valid JSON `.agent/` documents plus fixed safe templates from that evidence. A successful initialization SHALL create `.agent/config.json`, `.agent/rules.md`, `.agent/skills.json`, `.agent/memories.json`, and `.agent/context.ignore` when those files do not exist. Initialization SHALL report conflicts or existing incompatible configuration before overwriting it, SHALL preserve existing governance files unless `--force` is explicit, and SHALL emit no executable directive or credential material.

#### Scenario: A project is initialized
- **WHEN** an operator runs `sibyl init` in a repository containing supported manifests
- **THEN** the CLI writes schema-valid `.agent/` metadata for the detected stacks, reports each created file, and exits successfully

#### Scenario: Multiple runtimes are detected
- **WHEN** a repository contains supported manifests for JavaScript or TypeScript, Rust, Python, Go, or PHP
- **THEN** the generated configuration records each manifest, its detected runtime ownership, its package-manager identity when known, and its lockfile evidence when present

#### Scenario: Initialization finds supported manifests
- **WHEN** a repository contains one or more supported package, workspace, runtime, or documentation manifests
- **THEN** the generated configuration records the detected manifest evidence, maps each detected runtime to an owner, declares only safe inspection commands, and preserves the required explicit-remote-mutation and separate-remote-evidence controls

#### Scenario: Initialization encounters existing governance files
- **WHEN** `sibyl init` finds any target `.agent/` file or existing metadata that conflicts with the generated result
- **THEN** it exits non-zero with the conflicting paths and does not replace them unless the operator supplies the documented `--force` option

#### Scenario: Initialization encounters an existing incompatible configuration
- **WHEN** `sibyl init` finds existing `.agent/` content that conflicts with detected metadata
- **THEN** it exits non-zero or requests the documented explicit overwrite mode and does not silently discard existing governance data

#### Scenario: Initialization finds no supported manifest
- **WHEN** a repository contains no supported primary manifest or supplementary stack evidence
- **THEN** the CLI reports that no supported stack was detected, does not claim a detected runtime, and exits non-zero without writing partial governance metadata

#### Scenario: Generated metadata is inspected
- **WHEN** an operator reads the files produced by a successful initialization
- **THEN** the files contain declarative metadata, the required safe-command and remote-evidence controls, and no credentials, private keys, or executable instructions

### Requirement: `sibyl check` validates stack invariants without mutation

The CLI SHALL provide `sibyl check`, SHALL load the selected `.agent/` configuration and invariant metadata together with supported manifest evidence, SHALL parse supported manifests and available lockfiles without executing project code or resolving dependencies, SHALL compare every detected dependency against selected local stack invariants, and SHALL obtain package-ban relationships only from an explicitly supplied local registry snapshot. It SHALL report every violation with stable diagnostics. The command SHALL support machine-readable JSON output and a dense ANSI-capable terminal table containing the affected package, severity, reason, approved replacement, and a `banned -> approved` replacement rendering when applicable. It SHALL return non-zero when the project is not compliant or when required evidence is invalid. The command SHALL not execute project code, install dependencies, contact a remote service, or modify the project. A registry option or environment setting SHALL refer only to a local source; the command SHALL not fall back to a remote API.

#### Scenario: A project satisfies its invariants
- **WHEN** an operator runs `sibyl check` against a project whose detected dependencies and configuration satisfy the selected rules
- **THEN** the CLI exits successfully and reports a machine-readable compliant result with no violations

#### Scenario: A project violates a package invariant
- **WHEN** a project manifest or lockfile contains a dependency banned by the selected local policy
- **THEN** the CLI exits non-zero, reports every matched violation with the package, severity, reason, and approved replacement, and renders the replacement as `banned -> approved` in human-readable output

#### Scenario: A project violates an invariant
- **WHEN** an operator runs `sibyl check` against a project with a missing, incompatible, or disallowed dependency/configuration
- **THEN** the CLI exits non-zero, identifies the violated invariant and evidence, and does not modify the project

#### Scenario: Multiple violations are present
- **WHEN** more than one dependency violates the selected policies
- **THEN** the CLI reports all violations in deterministic package and severity order rather than stopping at the first match

#### Scenario: JSON output is requested
- **WHEN** an operator runs `sibyl check --json`
- **THEN** the CLI emits valid machine-readable JSON without ANSI escape sequences and includes the aggregate compliance result and all diagnostics

#### Scenario: A project has malformed governance or manifest metadata
- **WHEN** `.agent/config.json`, a selected invariant source, a supported manifest, or a required lockfile is missing required fields, declares an unsupported version, or contains invalid syntax
- **THEN** the CLI exits non-zero with field- or path-level diagnostics and performs no project or network mutation

#### Scenario: A project has malformed governance metadata
- **WHEN** `.agent/config.json` or a selected invariant document is missing required fields, declares an unsupported version, or contains unsafe content
- **THEN** the CLI exits non-zero with field-level diagnostics and performs no project or network mutation

#### Scenario: No local package policy source is configured
- **WHEN** the project has detected dependencies and no local registry snapshot is supplied
- **THEN** the CLI performs governance and manifest checks, reports package policy as not configured, exits non-zero, and does not claim compliance or contact a remote service

#### Scenario: The check source is remote or unavailable
- **WHEN** the operator supplies a remote registry URL or the selected local registry source cannot be read or validated
- **THEN** the CLI rejects the source safely, does not contact the remote URL, and exits non-zero without claiming compliance

### Requirement: `sibyl sync` uses explicit edge authorization and bounded effects

The CLI SHALL provide `sibyl sync` for episodic-memory and AST-skeleton synchronization, SHALL require a payload path, an HTTPS endpoint supplied through the documented configuration, and an authorization value supplied through the environment, SHALL validate the payload against the supported schema and secret-content rules before transmission, and SHALL report remote failures without exposing credentials or silently claiming convergence. It SHALL use bounded request timeouts and retries, and it SHALL report a remote acknowledgement or revision only after receiving a successful response. `sibyl sync` SHALL be the only command permitted to contact a remote service.

#### Scenario: A synchronization request is authorized
- **WHEN** an operator runs `sibyl sync` with valid local data, endpoint, authorization, and connectivity
- **THEN** the CLI validates the payload, performs the synchronization, and reports the remote acknowledgement or revision

#### Scenario: Synchronization prerequisites are absent
- **WHEN** the endpoint, authorization, payload validation, or remote service is unavailable
- **THEN** the CLI exits non-zero, identifies the failed prerequisite, performs no request, and does not print secret values

#### Scenario: The configured endpoint is unsafe
- **WHEN** the configured endpoint is not HTTPS or embeds credentials in its URL
- **THEN** the CLI rejects it before transmission and does not contact the endpoint

#### Scenario: Remote synchronization fails
- **WHEN** the remote service returns a failure or bounded transport retries are exhausted
- **THEN** the CLI exits non-zero with a safe failure diagnostic and does not report convergence or a fabricated acknowledgement

#### Scenario: A non-sync command is invoked
- **WHEN** an operator runs `sibyl init`, `sibyl check`, or `sibyl memory add`
- **THEN** the command performs no network request, regardless of whether synchronization configuration exists in the environment

### Requirement: `sibyl memory add` appends declarative local memory

The CLI SHALL provide `sibyl memory add <title> <content> --category <category>`, SHALL validate non-empty title, content, and category values, and SHALL append one schema-valid declarative memory entry to `.agent/memories.json`. It SHALL create the document when absent, preserve existing valid entries, reject malformed or unsafe existing documents without rewriting them, and perform no network access or project-code execution. The command SHALL report the added entry and return non-zero for invalid input or write failures.

#### Scenario: An invariant memory is added
- **WHEN** an operator supplies a title, content, and `--category invariant` in a project with no memory document
- **THEN** the CLI creates `.agent/memories.json` with the versioned memory document and one entry containing the supplied values

#### Scenario: An entry is appended to existing memories
- **WHEN** `.agent/memories.json` contains valid entries and the operator adds another memory
- **THEN** the CLI preserves the existing entries, appends exactly one new entry, and keeps the document deterministically serializable

#### Scenario: Memory input is invalid or unsafe
- **WHEN** the title, content, or category is empty, or the new entry contains prohibited credential or executable-instruction material
- **THEN** the CLI exits non-zero and leaves `.agent/memories.json` unchanged

#### Scenario: The memory document is malformed
- **WHEN** `.agent/memories.json` is not valid according to the supported declarative schema
- **THEN** the CLI reports the document error, does not overwrite it, and performs no network request

### Requirement: Rust quality gates are reproducible offline

The Rust workspace SHALL expose format, Clippy, build, test, and supported coverage commands, SHALL commit its lockfile, and SHALL keep baseline tests runnable without provider credentials or unintended production network access.

#### Scenario: Rust validation runs offline
- **WHEN** an engineer runs the documented locked Rust validation commands without provider credentials
- **THEN** formatting, linting, compilation, and baseline tests validate the backend and CLI, while any explicitly external test is separately identified
