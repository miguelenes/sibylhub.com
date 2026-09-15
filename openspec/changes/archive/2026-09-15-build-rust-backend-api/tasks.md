## 1. Workspace and configuration foundation

- [x] 1.1 Update the backend Cargo manifest to inherit all workspace package settings and add only the workspace-owned dependencies required for registry HTTP loading and bounded HTTP timeouts; verify dependency resolution with `cargo check -p sibyl-backend --locked`
- [x] 1.2 Implement typed backend configuration for `SIBYL_BIND`, `SIBYL_SCHEMA_VERSION`, `SIBYL_REGISTRY_SNAPSHOT`, `SIBYL_REGISTRY_URL`, `SIBYL_ENV`, and `RUST_LOG`, including defaults and secret-safe diagnostics; verify valid, missing, and malformed environment cases with configuration tests
- [x] 1.3 Update the backend package bridge, Turborepo metadata, and `.env.example` only where needed to expose the locked dev/build/lint/typecheck/test commands and the new runtime defaults; verify the scripts and generated build target match the repository task graph

## 2. Registry loading and invariant engine

- [x] 2.1 Add typed Rust representations and validation for the shared schema `2.0` index and language artifacts, including schema version, revision identity, canonical paths, stable identifiers, and relationship checks; verify the checked-in split registry fixture loads and deliberately invalid fixtures fail before serving
- [x] 2.2 Add the explicitly selected legacy `1.0` adapter and the empty offline registry fallback without allowing an invalid configured source to degrade silently to empty data; verify local, legacy, empty, malformed, unsupported-version, and inconsistent-source cases
- [x] 2.3 Implement the startup registry source resolver with local-snapshot precedence, optional HTTPS public-export loading through the workspace HTTP client, bounded response/time limits, and secret-free error context; verify no-network startup when no URL is configured and deterministic local loading when both sources are present
- [x] 2.4 Build immutable in-memory indexes for language/runtime/manifest metadata, evidence rules, normalized package aliases, and runtime-scoped banned-package policies; verify package checks use the indexed path and cover stable IDs, slugs, PURL names, runtime scoping, replacements, and reasons
- [x] 2.5 Preserve the existing structured evidence-validation semantics while adapting them to the normalized registry view; verify known valid evidence, diagnostics for each evidence mismatch, unresolved identities, malformed input, and rejection of caller-supplied `compliant`

## 3. Server lifecycle and HTTP API

- [x] 3.1 Split the backend into `server.rs`, `routes/`, and `engine/` modules with one immutable application state, typed API errors, CORS/trace/timeout layers, and router construction usable by tests; verify the crate compiles and every handler returns errors without `unwrap()` or panic paths
- [x] 3.2 Implement environment-aware tracing initialization with JSON production output, ANSI-capable development output, `RUST_LOG` filtering, and secret-safe request context; verify representative production and development records contain no credentials, private keys, request bodies, or provider payloads
- [x] 3.3 Implement `GET /healthz` with `status: "ok"`, version `0.1.0`, and an RFC 3339 UTC timestamp, plus the revised default bind address `0.0.0.0:8080`; verify the response fields and timestamp parsing through a port-free request test
- [x] 3.4 Implement `GET /v1/ecosystems` as a typed projection of active languages, detected manifests, and default package managers, including the documented empty result; verify the populated schema `2.0` fixture and empty offline state
- [x] 3.5 Implement `POST /v1/invariants/check` with strict request decoding for `ecosystem`, `runtime`, and dependency version-map values, deterministic violation ordering, compliant responses, and structured 400 errors; verify the TypeScript/Cloudflare-style banned-package response and a compliant dependency set
- [x] 3.6 Implement `POST /v1/context/budget` with `context_ceiling_tokens`, exact percentage partitions, largest-remainder rounding in the documented field order, and structured validation errors; verify the 128000-token result, a non-divisible ceiling, and invalid/unknown-field requests
- [x] 3.7 Implement graceful shutdown for SIGINT and SIGTERM with bounded in-flight request completion and typed signal/serve error propagation; verify the shutdown future and server path with focused lifecycle tests or a controlled signal test

## 4. Port-free integration coverage

- [x] 4.1 Add `apps/backend/tests/api_tests.rs` using the Axum router and `tower::ServiceExt` or `axum_test` without binding raw network ports; verify health, ecosystems, package checks, context budgets, and the preserved evidence-validation endpoint
- [x] 4.2 Add integration assertions for malformed JSON, unknown fields, unresolved ecosystem/runtime identities, empty snapshots, policy violations, exact budget totals, stable error bodies, and non-success statuses; verify the server remains usable after each client error
- [x] 4.3 Add focused engine tests for schema-version rejection, split-artifact consistency, package alias indexing, runtime-scoped policy matching, deterministic violation ordering, and integer budget allocation; verify tests run without provider credentials or unintended network access

## 5. Documentation and compatibility

- [x] 5.1 Update backend guidance, `.env.example`, root README API/port references, and backend documentation for the health response, schema source selection, `/v1/invariants/check`, and `/v1/context/budget`; verify every documented request and response matches the integration fixtures
- [x] 5.2 Document the additive relationship between `/v1/invariants/check` and `/v1/invariants/validate`, the explicit legacy schema mode, empty offline behavior, and local-versus-remote evidence boundaries; verify existing `/v1/invariants/validate` consumers remain represented

## 6. Finish gates

- [x] 6.1 Run the backend locked checks `cargo fmt -p sibyl-backend -- --check`, `cargo check -p sibyl-backend --locked`, `cargo clippy -p sibyl-backend --all-targets --locked -- -D warnings`, `cargo test -p sibyl-backend --locked`, and `cargo build -p sibyl-backend --release --locked`; verify each result separately
- [x] 6.2 Run the repository-required `pnpm check:config`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build` gates as applicable to the completed workspace change; verify failures are reported with their owning package and are not represented as deployment evidence
- [x] 6.3 Review the final diff and working-tree scope for secret material, unrelated edits, undocumented breaking behavior, and missing locked-file updates; verify only the approved backend implementation, tests, bridges, and documentation are included
