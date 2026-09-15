## 1. Shared contract and dependency setup

- [ ] 1.1 Run `pnpm check:config` before any package work and confirm the repository still reports the existing application, dependency-manager, and governance boundaries without modifying unrelated files.
- [ ] 1.2 Extend the canonical shared-schema TypeScript types and validators with the versioned `.agent/memories.json` document, ordered memory entries, required fields, unknown-field rejection, and unsafe-content rejection; verify the new validator tests pass.
- [ ] 1.3 Extend the canonical schema build source and fixtures for `memories.json`, regenerate `packages/schemas/dist` and `packages/schemas/json-schema` through `pnpm --filter @sibylhub/schemas build`, and verify the generated files are present and deterministic.
- [ ] 1.4 Add the required workspace Cargo pins and features for Clap `cargo`, terminal styling/table output, TOML/YAML parsing, and CLI test support; consume them from `apps/cli/Cargo.toml`, regenerate `Cargo.lock`, and verify `cargo metadata --locked --no-deps` succeeds.

## 2. CLI command boundary

- [ ] 2.1 Split the current command definitions into `apps/cli/src/cli.rs` and keep `src/main.rs` as the Tokio entry point and typed dispatcher; verify `sibyl --help`, `sibyl --version`, and an unknown command return the documented outputs and exit statuses.
- [ ] 2.2 Add the nested `memory add` command plus path, force, JSON, registry, payload, and category options; verify Clap rejects missing positional or required option values before any filesystem or network operation.
- [ ] 2.3 Add typed application errors and stable diagnostic serialization at the binary boundary; verify invalid local inputs return non-zero without printing credentials, private keys, or raw provider responses.

## 3. Scanner and manifest parsing

- [ ] 3.1 Implement the iterative scanner under `apps/cli/src/scanner/`, including relative-path reporting and pruning of `node_modules`, `target`, `vendor`, and `.git` before descent; verify skipped directories are never read and unrelated files do not become manifest evidence.
- [ ] 3.2 Implement deterministic detection for `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, and `composer.json`, including JavaScript versus TypeScript evidence and package-manager/lockfile selection, while preserving `pnpm-workspace.yaml`, `astro.config.ts`, and `docusaurus.config.ts` as supplementary evidence; verify a mixed-runtime temporary tree produces the expected primary and supplementary records.
- [ ] 3.3 Implement non-executing dependency extraction for JSON, TOML, Go module, Composer, pnpm lock, npm lock, Yarn lock, Python lock, Cargo lock, and `go.sum` inputs; verify declared package names and available versions are preserved and malformed files produce path-level errors.
- [ ] 3.4 Add scanner and parser unit fixtures for empty manifests, workspace dependency sections, optional/development dependencies, duplicate records, unsupported lockfile versions, and nested repositories; verify ordering and merge behavior are deterministic.

## 4. Local registry and policy evaluation

- [ ] 4.1 Implement the CLI-local registry adapter for a local schema 1.0 snapshot and the schema 2.0 `data/v1/index.json` plus language-artifact tree; verify revision identity, schema version, safe relative paths, stable relationships, and malformed artifacts fail closed.
- [ ] 4.2 Build an in-memory normalized policy index from validated language artifacts, including ecosystem/runtime aliases, banned package aliases, approved replacements, severity, and reason; verify the adapter does not scan the full registry for each dependency and never fabricates an identity.
- [ ] 4.3 Implement local registry selection with `--registry` taking precedence over `SIBYL_REGISTRY_SNAPSHOT`, reject URL or credential-bearing sources, and report package policy as not configured with non-zero status when dependencies exist without a registry; verify remote-looking inputs are rejected without a network request and an unconfigured-policy fixture cannot claim compliance.
- [ ] 4.4 Implement `sibyl check` aggregation across all detected manifests and lockfiles, stable violation ordering, aggregate compliance, and exit code `1` for violations, invalid evidence, or detected dependencies without a policy source; verify a dummy project reports every banned package, an unconfigured-policy project fails safely, and a compliant project with a local registry exits zero.

## 5. Governance initialization and memory writes

- [ ] 5.1 Implement deterministic generation of schema-valid JSON `.agent/config.json`, `.agent/skills.json`, and `.agent/memories.json` plus the fixed safe templates `.agent/rules.md` and `.agent/context.ignore` from scanner evidence; verify the JSON documents validate, the templates pass their path/content checks, and all five files contain no executable directives or credential material.
- [ ] 5.2 Add initialization preflight and protected writes so any existing target file blocks the operation unless `--force` is explicit, no partial files are created on failure, and non-target `.agent/` files remain untouched; verify against the repository's existing tracked governance files and a temporary conflict fixture.
- [ ] 5.3 Implement `sibyl memory add` validation, ordered append, deterministic serialization, and safe same-directory atomic replacement; verify a missing document is created, existing entries remain in order, malformed documents remain byte-for-byte unchanged, and invalid input returns non-zero.

## 6. Output and synchronization

- [ ] 6.1 Implement `apps/cli/src/ui.rs` for ANSI-aware monospace telemetry, dense dependency/violation tables, `banned -> approved` replacement rendering, and JSON output that contains no ANSI escapes; verify human and JSON outputs expose the same violations in the same order.
- [ ] 6.2 Preserve and modularize `sibyl sync` with HTTPS and no-credentials URL validation, environment authorization, payload schema/secret validation before request creation, bounded timeout/retries, and acknowledgement/revision-only success reporting; verify absent prerequisites, unsafe endpoints, rejected payloads, non-success responses, and exhausted retries fail safely.
- [ ] 6.3 Add an `indicatif` spinner only around authorized remote synchronization and suppress it for non-interactive output; verify `init`, `check`, and `memory add` never instantiate synchronization UI or make a request even when sync environment variables are set.

## 7. Integration tests and documentation

- [ ] 7.1 Add `apps/cli/tests/cli_tests.rs` using `assert_cmd` and `tempfile`; verify complete initialization output, primary and supplementary mixed-runtime evidence, force protection, memory append, malformed governance, unconfigured-policy failure, and read-only check behavior through the compiled `sibyl` binary.
- [ ] 7.2 Add an offline banned-package integration fixture using the repository's local registry export; verify non-zero status, all violation fields, replacement diff text, deterministic ordering, and no network access.
- [ ] 7.3 Update the nearest CLI or repository documentation with the final command tree, local registry selection, sync environment requirements, generated `.agent/` files, and canonical `target/release/sibyl` artifact; verify every documented command and variable matches the implementation.

## 8. Finish checks

- [ ] 8.1 Run the focused CLI commands `cargo fmt -p sibyl-cli -- --check`, `cargo check -p sibyl-cli --locked`, `cargo clippy -p sibyl-cli --all-targets --locked -- -D warnings`, `cargo test -p sibyl-cli --locked`, and `cargo build -p sibyl-cli --release --locked`; record each result separately.
- [ ] 8.2 Run the shared-schema checks and the repository finish gates `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build`; record focused local results separately from any remote deployment, R2/D1, or synchronization convergence evidence.
- [ ] 8.3 Read back the final change files, run strict OpenSpec validation for `add-workstation-cli`, and verify the diff contains no credentials, private keys, fabricated production identifiers, direct remote check path, or unintended edits outside the approved scope.
