## 1. Shared contract artifacts

- [x] 1.1 Consolidate the public ecosystem, agent configuration, skills, and invariant definitions behind versioned canonical TypeScript/Zod contracts and verify each exported contract reports its supported schema version.
- [x] 1.2 Extend the schemas build to generate deterministic, versioned JSON Schema files for all four contract families, including required nested fields, PURLs, and stable `$id` values; verify a clean build recreates the complete `json-schema/` set.
- [x] 1.3 Compile the schemas package into self-contained `dist/` JavaScript and declaration files, add package exports for validators, types, catalog helpers, and schema subpaths, and verify a consumer can import the built package without repository source files.
- [x] 1.4 Strengthen semantic ecosystem validation for all 25 language identities, required relationships, unresolved references, malformed PURLs, unsupported schema versions, and unsafe content; verify valid and invalid fixtures produce stable diagnostics.
- [x] 1.5 Add deterministic shared fixtures and cross-runtime contract-test inputs for valid, incomplete, incompatible, unresolved, and unsafe documents; verify regeneration is byte-stable from a clean generated-output directory.

## 2. Backend invariant evaluation

- [x] 2.1 Replace the client-authoritative `compliant` request field with a structured evidence request and stable success/error response types; verify malformed, unknown-language, unknown-invariant, and legacy requests return documented client errors without terminating the server.
- [x] 2.2 Implement registry-backed evaluation for the `declared-runtime-and-lockfile` rule, including invariant-to-language association, rule-declared evidence fields, and stable violation diagnostics; verify satisfying and violating evidence produce opposite results derived from the evidence and package-manager evidence is checked only when declared by the rule.
- [x] 2.3 Preserve snapshot schema and relationship validation while loading the generated contract fixtures; verify `cargo test -p sibyl-backend --locked` covers health, ecosystem, valid invariant, invalid invariant, and malformed request behavior.

## 3. Governed CLI initialization and checking

- [x] 3.1 Update `sibyl init` to map detected manifests to schema-valid `runtimeOwners`, `safeCommands`, manifest evidence, and explicit remote-evidence controls without emitting credentials or executable directives; verify initialization against representative workspace fixtures.
- [x] 3.2 Preserve initialization conflict and overwrite protections, including `--force`, and make generated `.agent/config.json` use the shared field names and schema version; verify existing incompatible metadata is not silently discarded.
- [x] 3.3 Implement read-only `sibyl check` loading of `.agent/` metadata, parsing declared package metadata from supported manifests, and evaluating selected registry invariants with stable machine-readable diagnostics and aggregate exit status; verify it performs no dependency resolution/install, script execution, network request, or file mutation.
- [x] 3.4 Add CLI tests for compliant projects, missing/incompatible manifests, malformed governance metadata, unsupported versions, and multiple simultaneous violations; verify `cargo test -p sibyl-cli --locked` and `cargo clippy -p sibyl-cli --all-targets --all-features --locked -- -D warnings` pass.

## 4. Authoritative deterministic backoffice export

- [x] 4.1 Seed a deterministic valid local `RegistryRevision` from the committed shared fixture and remove the exporter’s implicit fixture fallback; verify export fails clearly and writes no new artifact when no validated revision exists.
- [x] 4.2 Make revision validation cross-check the selected revision payload with its associated relationship records and shared-schema constraints before serialization; verify unresolved, incomplete, unsafe, and invalid revisions are rejected before the export path is written.
- [x] 4.3 Canonicalize every exported collection and nested relationship list by stable identifiers and serialize the selected revision deterministically; verify repeated exports and reordered equivalent source data produce byte-identical JSON.
- [x] 4.4 Preserve the local-only publication boundary and revision identity in export output; verify the artisan command writes only under `storage/app/exports` and performs no remote upload or publication implicitly.
- [x] 4.5 Update backoffice tests and local documentation for seeded revision setup, explicit revision selection, invalid-revision diagnostics, and deterministic output; verify the focused PHPUnit/Pest suite and Pint checks pass.

## 5. Cross-boundary integration and documentation

- [x] 5.1 Update backend API fixtures, CLI fixtures, PHP export fixtures, and documentation to describe the evidence-based invariant request and the generated schema artifact locations; verify all in-repository consumers use the same field names and schema versions.
- [x] 5.2 Add a cross-runtime verification command or test fixture workflow that checks the same valid and invalid contract documents in TypeScript, Rust, and PHP; verify acceptance and rejection decisions agree without network access.

## 6. Repository verification

- [x] 6.1 Run focused package, Rust, and backoffice checks for the changed areas, including `pnpm check:config`, schemas build/tests, locked Rust tests and clippy, Composer/PHP tests, and Pint; record each result separately. (`pnpm check:config`, schemas build/tests/typecheck, workspace Rust tests/clippy, Composer validation, PHP tests, and Pint all passed.)
- [x] 6.2 Run the documented root finish gates `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build`; verify failures are resolved or explicitly reported with their local-versus-remote evidence boundary. (All six gates passed; build output included only the existing Docusaurus deprecation warning.)
- [x] 6.3 Verify the final change artifacts and implementation read back cleanly, validate `complete-sibylhub-contracts` with OpenSpec strict validation, and confirm no credentials, remote identifiers, or generated source-relative package imports were introduced. (Clean regeneration was byte-stable, `verify:contracts` passed, strict OpenSpec validation passed, and searches found no introduced secrets or source-relative generated imports.)
