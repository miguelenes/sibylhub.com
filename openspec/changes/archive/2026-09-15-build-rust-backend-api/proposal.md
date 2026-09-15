## Why

SibylHub has an Axum backend, but its implementation and public contract do not yet provide the high-performance API surface described for ecosystem discovery, package-level invariant checks, and context-budget planning. The existing backend also needs to align with the current versioned shared-registry direction while preserving the evidence-based validation API already used by the workspace.

## What Changes

- Refactor the backend into explicit server, route, and invariant-engine modules while keeping the crate independently runnable through its existing Cargo and Turborepo bridges.
- **BREAKING** Update the documented readiness response to return `status`, backend `version`, and an RFC 3339 timestamp, and make the default bind address `0.0.0.0:8080` configurable through environment variables.
- Add environment-aware structured logging, using JSON in production and ANSI-formatted logs in development, with graceful SIGINT and SIGTERM shutdown.
- Keep `GET /v1/ecosystems` backed by a validated versioned registry export and expose the active languages, manifests, and default package managers through a stable response.
- Add `POST /v1/invariants/check` for constant-time package-identifier policy checks, including compliant status and structured violations with severity, replacement, and reason fields.
- Preserve `POST /v1/invariants/validate` as the structured project-evidence validation contract; the new package check is additive and does not accept caller-supplied compliance as proof for evidence validation.
- Add `POST /v1/context/budget` to calculate deterministic token partitions for rules, memories, AST skeletons, active files, and tools from a requested context ceiling.
- Load the in-memory registry cache from an explicitly configured public R2 export when available, otherwise use the documented local/offline fallback; reject unsupported schema versions before serving requests.
- Add port-free integration coverage for all public endpoints and update backend documentation and examples for the revised contract.

## Capabilities

### New Capabilities

None. The new routes and cache behavior extend the existing Rust platform service capability.

### Modified Capabilities

- `rust-platform-services`: expand the backend contract with package-level invariant checks and context-budget calculation, revise the readiness and bind configuration contract, and define versioned registry loading, logging, and shutdown behavior while preserving structured evidence validation.

## Impact

- Affected code: `apps/backend/Cargo.toml`, the backend source modules, backend integration tests, `.env.example`, and backend/root API documentation.
- Affected dependencies: the backend may need the `tower-http` timeout feature and an explicitly selected HTTP client or loader support for configured public R2 access; native Cargo workspace dependency ownership remains authoritative.
- Affected consumers: clients relying on the current health response or default loopback port must adopt the revised contract; existing `/v1/invariants/validate` consumers remain supported.
- Affected shared data: the backend will consume the existing schema `2.0` split registry contract and will not introduce a second incompatible ecosystem schema.
- Non-goals: Laravel table access, live trading, remote synchronization, database migrations, or deployment to Cloudflare/R2 infrastructure.
