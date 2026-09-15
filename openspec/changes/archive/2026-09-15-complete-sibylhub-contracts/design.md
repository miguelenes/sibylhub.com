## Context

The bootstrap currently defines Zod validators and TypeScript types in `packages/schemas`, but its build output points at source-relative modules and emits only the ecosystem JSON Schema. The Rust backend loads a versioned JSON snapshot but lets the request body assert its own compliance. The CLI has native manifest discovery but writes fields outside the shared agent contract and treats the presence of any manifest as compliance. The backoffice exporter selects a valid revision when available, otherwise falls back to a fixture, and sorts only the language collection.

The existing package boundaries remain authoritative: TypeScript owns schema generation, Rust owns API and CLI behavior, and Laravel owns registry revision administration and local export. Local validation must remain offline-capable and must not imply Cloudflare, remote storage, or synchronization convergence.

## Goals / Non-Goals

**Goals:**

- Make the shared schema package self-contained for installed consumers and generate all declared versioned contract artifacts from one TypeScript definition set.
- Make CLI initialization and checking produce and consume schema-valid declarative governance metadata without executing project code or contacting the network.
- Make backend invariant results derive from registry data and submitted evidence rather than from a client assertion.
- Make a validated backoffice revision the only ordinary export source and make its serialized bytes deterministic.
- Preserve the existing secret, local-only publication, native dependency-manager, and runtime ownership boundaries.

**Non-Goals:**

- Changing the Astro, Docusaurus, Filament, or Turborepo architecture.
- Renaming the `sibyl-backend` or `sibyl` Rust binaries.
- Adding production Cloudflare resources, remote R2 publication, database provisioning, or synchronization credentials.
- Proving filesystem evidence cryptographically at the backend; the backend validates the evidence contract against the registry, while the local CLI is responsible for collecting it.
- Inventing additional invariant rule languages beyond the rules represented by the versioned registry snapshot.

## Decisions

### 1. Keep Zod definitions canonical and generate distributable artifacts

The shared package will expose one set of public Zod contract definitions for ecosystem documents, agent configuration, skills, and invariant rules. TypeScript types and runtime validators will be derived from those definitions. The build will generate four versioned JSON Schema files with stable `$id` values and deterministic serialization, then compile the package source into `dist` with declarations rather than writing source-relative re-export stubs.

The package export map will point consumers to compiled files and expose the JSON Schema files through documented subpaths. The build will recreate `dist`, generated schemas, and fixtures from a clean output directory, so stale files cannot make a broken package appear usable.

JSON Schema will enforce document shape, required fields, PURLs, and schema-version compatibility. Relationship resolution and unsafe-content checks remain semantic validation performed by the canonical TypeScript validators, because cross-document references and secret-pattern rejection are not fully expressed by the structural schema alone.

### 2. Use shared fixtures as the cross-runtime contract boundary

The generated schemas and versioned fixtures are the interchange boundary for Rust, PHP, and documentation workflows. Native consumers may use typed adapters and boundary-specific semantic checks, but they will not define a second language catalog or silently accept fields rejected by the shared contract. Cross-runtime tests will exercise the same valid, incomplete, unresolved, incompatible, and unsafe fixtures.

The Rust applications will continue to use `serde` and explicit typed boundary checks rather than adding a network-dependent validation service. Registry identities and relationships will be read from the loaded snapshot. The CLI and backend will report the shared schema version and stable diagnostic codes when a document or snapshot fails validation.

### 3. Replace client compliance assertions with evidence evaluation

`POST /v1/invariants/validate` will require the selected `language_id`, `invariant_id`, and structured evidence such as the detected runtime, package manager, lockfile, and manifest paths. A request that supplies only the legacy `compliant` assertion, or omits the evidence required by the selected rule, will be rejected with a stable client diagnostic; the assertion will never be used as proof.

The backend will resolve the language and invariant from the loaded snapshot, verify that the invariant is associated with that language, select the declared rule, and evaluate the evidence against the language relationships. For the existing `declared-runtime-and-lockfile` rule, the runtime and lockfile evidence identifiers must match the language's registered relationships and the manifest evidence must be non-empty; package-manager evidence is validated only when the selected rule declares it. Malformed, unsupported, or unresolved request data produces a structured `400` client-validation error. Known evidence that violates a selected rule produces a structured `422` invalid result with stable diagnostics. The process remains alive in both cases.

This is intentionally a consistency check, not an attestation mechanism. A local CLI can inspect files, while the backend can only validate the evidence payload it receives.

### 4. Generate governed CLI metadata and keep checks read-only

`sibyl init` will derive `runtimeOwners` and detected manifest evidence from the existing supported-manifest scan, emit the required `safeCommands`, and always set the explicit remote-mutation and separate-remote-evidence controls required by the agent contract. It will continue to refuse overwrite unless `--force` is supplied.

`sibyl check` will load `.agent/config.json`, validate its schema version and safe declarative fields, parse declared package metadata from supported manifests, resolve the applicable registry snapshot, and evaluate every selected invariant with stable diagnostics. It will not resolve or install dependencies, execute project scripts, make network requests, or write files. JSON output will contain a compliant flag plus all diagnostics, and the process exit status will reflect the aggregate result.

### 5. Make validated revisions authoritative and serialization canonical

The validated `RegistryRevision` snapshot, including its revision payload and associated relationship records, is the canonical export source. The backoffice seeder will use the shared valid fixture to create a deterministic local revision marked valid. The fixture remains a seed/test input only; `RegistryExportService` will no longer use it as an implicit export fallback. An explicit revision or the latest validated local revision must exist, otherwise export fails before writing an artifact. The selected payload and its relational records must agree before the revision is exportable.

Before serialization, the exporter will validate the complete payload and relationships, recursively normalize object keys where needed, sort every catalog collection by stable `id`, sort each language's invariant identifiers, and serialize with the existing stable JSON options. Validation completes before the revision-specific output path is written. Remote publication remains a separate command and is not introduced into local export.

## Risks / Trade-offs

- [Breaking API request shape] Existing callers that send only `compliant` will fail validation. -> Update the documented request fixture and any in-repository callers in the same change; return a stable error for legacy requests rather than silently trusting them.
- [Structural/schema parity] JSON Schema cannot express every cross-document relationship or unsafe-content policy. -> Keep semantic validators at the canonical TypeScript boundary and run identical fixtures through the Rust and PHP boundary tests.
- [Local export dependency] Removing the fixture fallback means a fresh local database needs a seeded valid revision. -> Seed it deterministically from the committed fixture and fail closed when seeding or validation is absent.
- [Evidence is self-reported] Backend validation cannot prove that submitted manifest paths exist on the caller's machine. -> Keep filesystem inspection in `sibyl check` and document backend validation as evidence consistency, not remote attestation.
- [Canonicalization changes bytes] Existing consumers may compare the previous non-canonical order. -> Version the behavior through the existing schema/revision identity and make deterministic ordering part of the export contract before publication is enabled.

## Migration Plan

1. Add canonical contract definitions, generated JSON Schemas, compiled package output, and shared fixtures/tests.
2. Update Rust request/response adapters, invariant evaluation, CLI initialization, and read-only checking against the corrected artifacts.
3. Seed a valid local registry revision, remove implicit export fallback, and canonicalize all backoffice output collections.
4. Update API and command documentation plus in-repository fixtures for the breaking invariant request.
5. Run focused package checks, then the repository finish gates. Record local results separately from any unavailable remote deployment or publication evidence.

Rollback is a source-level revert of the change. No production migration, remote publication, or credential rotation is part of this change. Existing revisions that do not satisfy the corrected contract remain non-exportable until explicitly repaired or replaced by an administrator.
