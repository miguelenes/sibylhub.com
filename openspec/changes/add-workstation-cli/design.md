## Context

The current `apps/cli` package is a single `main.rs` implementation. It detects a small set of root-level files, writes only `.agent/config.json`, and validates manifest presence rather than dependency identities. The root Cargo workspace already owns the CLI and pins Clap, Tokio, Reqwest, Serde, and Indicatif, while the requested terminal and manifest-parser dependencies are not yet declared.

The backend already loads schema 2.0 registry exports as an index plus language artifacts and builds an indexed package-policy view. The CLI must remain an independent executable and must not depend on the backend process, Laravel tables, R2, D1, or a remote API for `init`, `check`, or `memory add`. The existing tracked `.agent/config.json` and `.agent/skills.json` also make silent initialization overwrite unsafe.

## Goals / Non-Goals

**Goals:**

- Give the CLI a typed command boundary and separate scanner, registry, governance, memory, and presentation responsibilities.
- Make local inspection deterministic, offline-capable, read-only except for explicitly requested governance and memory writes, and safe for arbitrary repositories.
- Consume the repository's versioned registry export shape and preserve stable package-policy diagnostics across human and JSON output.
- Keep the `sibyl` executable, Cargo package ownership, Turborepo bridge, and existing synchronization environment contract.
- Cover complete initialization, dependency-policy violations, memory append, malformed input, and non-mutation behavior with integration tests.

**Non-Goals:**

- Calling `POST /v1/invariants/check` or any other remote service from `sibyl check`.
- Direct R2 or D1 access. Those remain server-side synchronization concerns behind the configured HTTPS endpoint.
- Dependency installation, lockfile generation, project-script execution, AST execution, or cryptographic attestation of local evidence.
- Renaming the binary to `cli` or changing the canonical release artifact from `target/release/sibyl`.
- Defining a second registry catalog or changing the backend registry API.

## Decisions

### 1. Keep the command tree in a library-style module

`src/main.rs` will remain a small Tokio entry point that parses `cli::Cli` and dispatches typed command values. `src/cli.rs` will own the Clap derive structures for `init`, `check`, `sync`, and nested `memory add`, including path, force, JSON, registry, payload, and category options. Command handlers will return typed application errors so the binary can print safe diagnostics and exit non-zero without exposing source errors or authorization values.

The implementation will not make the CLI a backend subcommand. That alternative would couple local inspection to server configuration and make the remote boundary harder to audit.

### 2. Scan with an iterative standard-library walker

The scanner will walk repository directories iteratively and skip `node_modules`, `target`, `vendor`, and `.git` before descending. It will compare entry names as `OsStr` values, read only supported manifest and lockfile candidates, and return relative paths plus typed manifest records. It will not shell out or load project code.

The hot filtering path will avoid allocating strings for unrelated files and will reuse traversal state where possible. Filesystem enumeration itself can allocate inside the operating-system and standard-library APIs, so the practical guarantee is bounded allocation by directory depth and matched metadata rather than a literal zero-allocation filesystem traversal. The scanner will document this boundary and avoid an external walker dependency.

Manifest detection will use these rules:

- `package.json` maps to JavaScript unless explicit TypeScript evidence is present in the manifest or adjacent configuration, in which case it maps to TypeScript.
- `Cargo.toml` maps to Rust, `pyproject.toml` maps to Python, `go.mod` maps to Go, and `composer.json` maps to PHP.
- Lockfile precedence follows the package-manager family. JavaScript prefers pnpm, npm, then Yarn; Rust uses `Cargo.lock`; Python recognizes the supported Poetry or uv lockfiles; Go uses `go.sum`; and PHP uses `composer.lock`.
- Stable runtime, package-manager, and lockfile identifiers use the registry vocabulary where it provides a matching record. The CLI will report an unresolved identity instead of fabricating a package identity for policy evaluation.
- Existing supplementary evidence files, including `pnpm-workspace.yaml`, `astro.config.ts`, and `docusaurus.config.ts`, remain detectable for workspace, application, and documentation context. They do not become dependency manifests and do not add package records unless a supported primary manifest supplies them.

### 3. Parse dependencies without resolving them

The scanner/parser boundary will convert supported manifests and lockfiles into a deterministic `BTreeMap<String, String>` per ecosystem. JSON manifests will read the dependency groups defined by each package format, TOML manifests will read declared dependency tables, `go.mod` will read `require` blocks, and Composer JSON will read `require` and `require-dev`. Lockfile readers will contribute installed version evidence when available but will never fetch or solve a dependency graph.

The CLI will use `serde_json` for JSON, a pinned TOML parser for `Cargo.toml` and `pyproject.toml`, and a pinned YAML parser for pnpm lockfiles. Go module syntax and Yarn lock syntax will use bounded line-oriented parsers because their relevant dependency records are not JSON or TOML. Each parser will reject malformed input with a path-level diagnostic and will preserve package names and versions exactly enough for policy matching.

### 4. Load policy only from an explicit local source

`sibyl check` will accept a local registry path through `--registry` and, when the option is absent, through `SIBYL_REGISTRY_SNAPSHOT`. The option takes precedence over the environment. A directory source will resolve `data/v1/index.json` and its referenced language files, matching the backend's schema 2.0 layout. A legacy schema 1.0 JSON snapshot remains an explicitly supported local compatibility input. URLs, credentials in paths, and remote fallbacks will be rejected before any request could occur.

The CLI will implement a small typed registry adapter inside the CLI package rather than depend on the backend application crate. It will validate schema version, revision identity, safe relative artifact paths, language relationships, and package-policy references before building an in-memory index keyed by normalized ecosystem, runtime, and package aliases. This keeps the two applications independently runnable while testing both against the same committed registry fixtures. The existing `.agent/invariants.json` remains a governance and configuration input; package-ban policy comes from the validated local registry snapshot. When no local policy source is configured, the command will still perform governance and manifest checks, report package policy as not configured, and return non-zero when dependencies are present so it cannot imply compliance without a policy source. A project with no detected dependencies may succeed if its governance and manifest checks pass.

Policy results will contain the package, severity, approved replacement, and reason. Results will be sorted by package, severity, replacement, and reason so JSON and terminal output are stable. The human renderer will show the replacement as `banned -> approved`; the JSON renderer will contain no terminal escape sequences.

### 5. Generate governance documents through protected, deterministic writes

`init` will perform a complete preflight before creating `.agent/` or writing any target file. Without `--force`, the presence of any target file is a conflict and produces a path-specific error with no partial write. With `--force`, the command may replace only the five files owned by this initializer after all inputs have been parsed successfully. Writes will use a temporary file in `.agent/` followed by a same-directory rename so a failed write does not leave a truncated document.

The generated JSON documents will use stable field ordering from typed Serde structs and one trailing newline. The memory document will have the shape `{ "schemaVersion": "1.0", "memories": [] }`, with entries containing `title`, `content`, and `category`. It will not include volatile timestamps or generated identifiers. Schema validation applies to the generated JSON documents and invariant JSON; `rules.md` and `context.ignore` use fixed declarative templates with path and content checks rather than JSON Schema. `skills.json` will contain declarative entries for the detected runtime scopes. Existing non-target files under `.agent/` will not be removed.

`memory add` will use the same parser and protected-write path. It will load and validate the current memory document, reject unsafe or unknown fields before writing, append one entry, and serialize the complete collection deterministically. It will never merge malformed content or replace a file after a validation failure.

### 6. Keep terminal presentation separate from command behavior

`src/ui.rs` will own color and table formatting. `console` will select ANSI styling based on terminal support, and `comfy-table` will format the dependency and violation table. JSON mode will bypass both styling and table formatting. Invariant replacement output will use a short `banned -> approved` diff string, with the full reason in its own column.

`indicatif` will be used only around the authorized `sync` request. The spinner will be hidden or suppressed for non-interactive output. Local commands will not create a spinner, access synchronization configuration as a reason to contact a service, or print environment values.

### 7. Preserve the narrow synchronization boundary

`sync` will keep `SIBYL_SYNC_ENDPOINT`, `SIBYL_SYNC_AUTH_TOKEN`, and `--payload` as its explicit inputs. The endpoint will be parsed as a URL and must be HTTPS with no username or password. Payload validation will accept only the supported `episodic-memory` and `ast-skeleton` envelope kinds, reject unsupported schema versions and prohibited secret material, and complete before constructing a request.

Reqwest will use the existing rustls and JSON features with a bounded timeout and at most three attempts. A successful response must provide a successful status before the CLI prints acknowledgement or revision information. Transport failure, non-success status, malformed acknowledgement, or exhausted retries will return a safe error and will not claim convergence. The token will be held only for request authentication and will not appear in diagnostics.

### 8. Extend workspace dependencies without crossing runtime ownership

The root Cargo manifest will add the Clap `cargo` feature and workspace pins for `console`, `comfy-table`, TOML/YAML parsing, and the test support crates. `apps/cli/Cargo.toml` will consume those workspace entries. Tokio and Reqwest will retain their existing feature sets. `assert_cmd` and `tempfile` will be development dependencies used by `tests/cli_tests.rs`; no JavaScript, Composer, or backend dependency graph will be copied into the CLI.

The existing `apps/cli/package.json` scripts and `turbo.json` output will remain the package bridge. The release output remains `../../target/release/sibyl`.

### 9. Test through the compiled command boundary

Unit tests will cover scanner detection, parser extraction, policy normalization, document validation, and sync payload rejection. Integration tests will use `assert_cmd` and `tempfile` to create projects containing all supported manifest families, invoke the compiled `sibyl` binary, verify all five initialization files, append an invariant memory, and run a banned-package check against a local registry fixture.

The integration suite will assert non-zero exits for malformed governance and policy input, verify `--json` has no ANSI escapes, and compare file contents before and after `check` to prove read-only behavior. It will not require credentials or a live service. Sync transport behavior will remain covered by validation and endpoint-rejection tests unless a separately authorized local HTTPS test server is added later.

## Risks / Trade-offs

- [Filesystem APIs prevent a literal zero-allocation walker] → Keep allocation out of unrelated-file filtering, bound owned traversal state, and document the measurable guarantee instead of claiming an impossible one.
- [Manifest formats have different dependency semantics] → Keep one parser per format, merge only documented dependency sections, preserve source paths in diagnostics, and test representative fixtures for each supported ecosystem.
- [The registry fixture uses stable synthetic package identities] → Match aliases from the validated local snapshot and never substitute real package names or fabricate an approved replacement.
- [Schema changes can drift between TypeScript, Rust, and PHP] → Add the memories document to the canonical shared schema package and exercise its fixture through the existing cross-runtime validation gates.
- [Forced initialization can replace user governance data] → Require `--force`, preflight every target, replace only the five owned paths, and use atomic same-directory writes.
- [Remote acknowledgement may not prove downstream convergence] → Report only the response's explicit acknowledgement or revision and label local request success separately from remote system convergence.
- [New parser dependencies expand the locked Rust graph] → pin them at the workspace root, regenerate `Cargo.lock`, and run locked offline-capable package checks before broader repository gates.

## Migration Plan

1. Extend the shared schema types, JSON Schema, fixtures, and validators for `.agent/memories.json`.
2. Refactor the CLI command tree, scanner, parsers, local registry adapter, governance writers, memory handler, and UI.
3. Add workspace dependency pins, CLI development dependencies, integration fixtures, and the final package bridge checks.
4. Run focused CLI checks, then the repository's required `pnpm check:config`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build` gates. Report local results separately from any unavailable remote evidence.

No automatic migration will touch the repository's existing `.agent/` files. Users must invoke `sibyl init --force` to replace a target file after reviewing the generated result. Rollback is a source-level revert; no remote resource or database migration is part of this change.

## Open Questions

None. The binary name, local registry selection, synchronization environment names, generated memory shape, and supported initialization files are fixed by this design and the accompanying specifications.
