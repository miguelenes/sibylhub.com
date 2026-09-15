## MODIFIED Requirements

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

## ADDED Requirements

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
