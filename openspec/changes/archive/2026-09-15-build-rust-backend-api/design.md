## Context

The current backend keeps configuration, snapshot loading, routing, handlers, and validation in `apps/backend/src/lib.rs`. It serves a legacy monolithic registry snapshot and already has consumers of the structured `/v1/invariants/validate` contract. The shared schema contract now defines schema `2.0` as an index plus per-language artifacts, while the root Cargo workspace already owns `reqwest`, `serde`, `tokio`, `tower-http`, and tracing dependencies. See `proposal.md` for the motivation and `specs/rust-platform-services/spec.md` for the externally visible behavior.

## Goals / Non-Goals

**Goals:**

- Establish one typed application state and a clear separation between configuration, server lifecycle, route handlers, registry loading, and policy evaluation.
- Make the new package-policy and context-budget endpoints deterministic, testable without network sockets, and compatible with the existing evidence-validation endpoint.
- Consume the shared schema `2.0` registry without creating a second ecosystem data model, while retaining an explicitly selected legacy adapter for existing validation consumers during migration.
- Keep startup and request failures typed, bounded, and safe to expose in logs or JSON responses.

**Non-Goals:**

- Changing the shared schema package or publishing a new R2 artifact.
- Connecting to Laravel tables, adding a database, executing project commands, or performing remote synchronization.
- Deploying the service, configuring Cloudflare/R2 infrastructure, or proving remote runtime convergence.

## Decisions

### 1. Use explicit backend modules around a shared application state

`main.rs` will own logging initialization and process entry. `server.rs` will own configuration, listener setup, signal handling, and router construction. `routes/` will contain the health, ecosystem, invariant, and budget handlers. `engine/` will contain registry normalization, validation, and package-policy indexes.

Handlers will receive an immutable `Arc<AppState>` through Axum state and return typed results. This keeps request paths free of global mutable state and makes the router directly usable by integration tests.

The alternative was to keep extending `lib.rs`; that minimizes file movement but makes the new loader, two invariant contracts, and budget calculation share increasingly implicit state and error behavior.

### 2. Normalize schema `2.0` into an internal registry view

The loader will deserialize the index and referenced language artifacts into Rust records that mirror the shared schema fields needed by the API. It will verify schema version, revision identity, canonical language paths, required relationships, and identifier uniqueness before constructing the serving state.

The normalized view will expose:

- language records and their artifact references;
- runtime and package-manager records grouped by language;
- manifest and default-manager projections for ecosystem responses;
- evidence rules for `/v1/invariants/validate`;
- package aliases and runtime-scoped policy rules for `/v1/invariants/check`.

Schema `1.0` remains available only through an explicit legacy loading mode. The adapter maps it into the same internal view so existing evidence validation does not silently change semantics. The default mode follows the shared schema `2.0` contract.

### 3. Make registry source selection explicit and offline-safe

Configuration will use the following sources and precedence:

1. `SIBYL_REGISTRY_SNAPSHOT`, when set, loads a local file and is preferred for deterministic development and tests.
2. `SIBYL_REGISTRY_URL`, when set without a local snapshot, loads the public registry index and its referenced language artifacts over HTTPS.
3. With neither source configured, the backend starts with the documented empty registry result.

A configured source that cannot be read, parsed, or validated is a startup error. The service will not silently replace an explicitly selected invalid snapshot with empty data. The HTTP loader will use the workspace-owned `reqwest` client with bounded request timeouts and response sizes; it will never send credentials because the registry is public.

The alternative was to fetch R2 on every request, which would add network latency and make readiness depend on remote availability. Startup loading plus immutable in-memory state gives predictable request latency and a clear snapshot boundary.

### 4. Build package policy indexes once at startup

The engine will normalize each package record's stable `id`, `slug`, and PURL name into a package-identifier lookup. Each invariant will contribute a runtime-scoped rule keyed by its banned package identifier. A check request performs an expected O(1) lookup per submitted dependency and emits the rule's severity, reason, and resolved approved replacement.

Runtime-specific rules apply when their `runtimeId` matches the request; rules without a runtime constraint apply to all supported runtimes for that ecosystem. Unknown ecosystem or runtime identities are client errors so a typo cannot look compliant. The request's version ranges are validated as strings but policy matching is identifier-based; dependency resolution and installation are outside this API.

The alternative was a full invariant scan for every dependency. That is simpler for a small fixture but makes latency scale with registry size and works against the requested high-performance path.

### 5. Preserve evidence validation as a separate contract

`/v1/invariants/validate` will retain its current structured request fields, diagnostics, status codes, and rejection of client-supplied `compliant` assertions. `/v1/invariants/check` will have its own request and response types and will not reuse the evidence-validation response by adding optional fields.

This separation prevents a package dependency policy result from being mistaken for proof that a project satisfies a broader invariant. It also allows existing CLI consumers to migrate independently.

### 6. Use fixed-field response types for ecosystem, health, and budget APIs

The handlers will serialize dedicated structs rather than returning arbitrary `serde_json::Value` objects. The budget response will contain `context_ceiling_tokens` and a `partitions` object with `rules`, `memories`, `ast_skeletons`, `active_files`, and `tools`.

Budget percentages will be calculated using integer arithmetic. The exact requested ceiling will be preserved using largest-remainder allocation, with ties resolved in the documented field order: Rules, Memories, AST Skeletons, Active Files, Tools. This makes non-divisible ceilings reproducible across runtimes.

### 7. Select logging format from an explicit runtime environment

`SIBYL_ENV=production` will select JSON tracing output; all other documented development values will select ANSI-capable human-readable output. `RUST_LOG` remains the filter source. Request tracing will include route and status context but no request body, authorization value, registry payload, or provider response.

The alternative was unconditional JSON output, which is machine-friendly but degrades local diagnosis and does not satisfy the production/development distinction.

### 8. Combine bounded graceful shutdown with the existing HTTP timeout layer

The server will use Axum's graceful-serving hook with a shutdown future that listens for Ctrl-C/SIGINT and SIGTERM. A `tower-http` timeout layer will bound in-flight requests during normal operation and shutdown. Signal registration failures will propagate as typed startup/runtime errors.

## Risks / Trade-offs

- [Schema drift between TypeScript exports and Rust records] -> Validate schema version, revision identity, paths, and relationships before installing state; test against the checked-in schema `2.0` fixture.
- [Public R2 availability or content changes affect startup] -> Fetch only when explicitly configured, bound the request, require complete validation, and allow an explicitly configured local snapshot for deterministic fallback.
- [Changing the default bind address exposes the listener beyond loopback] -> Document the change, retain `SIBYL_BIND` override support, and make deployment/network policy an explicit operational gate.
- [Package aliases do not match a client's package-manager spelling] -> Index stable IDs, slugs, and PURL names; cover namespaced and unnamespaced identifiers in integration tests.
- [Integer budget rounding differs between implementations] -> Specify largest-remainder allocation and tie order in the contract, then test both divisible and non-divisible ceilings.
- [Changing the health payload breaks older clients] -> Treat the change as an explicit contract migration, update documentation and fixtures, and keep `/v1/invariants/validate` unchanged for existing consumers.

## Migration Plan

1. Implement the module split, typed registry view, new handlers, configuration fields, and integration tests within `apps/backend`.
2. Update `.env.example`, backend documentation, and root API references for `SIBYL_BIND`, `SIBYL_ENV`, `SIBYL_REGISTRY_URL`, the new health response, package checks, and context budgets.
3. Run the backend's locked format, check, lint, test, and build commands, then run the documented root gates where the task graph requires them. Keep local checks distinct from any remote R2 or deployment evidence.
4. Roll out clients using `/v1/invariants/check` and `/v1/context/budget`; migrate health consumers to the new response and port configuration.
5. If rollback is required, revert the backend binary and documentation together. The preserved `/v1/invariants/validate` route remains the compatibility path for existing evidence-validation clients.
