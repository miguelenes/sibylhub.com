## Why

The repository has a minimal `sibyl` prototype, but it cannot yet initialize the complete governed project metadata, inspect dependency identities across the supported runtimes, report package-policy violations, or append local episodic memories. The CLI needs a release-ready implementation that keeps project inspection offline and reserves network access for explicitly authorized synchronization.

## What Changes

- Refactor `apps/cli` into a modular Rust CLI with command definitions in `src/cli.rs`, a reusable manifest and directory scanner, and terminal presentation in `src/ui.rs`.
- Extend `sibyl init` to inspect the primary dependency manifests `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, and `composer.json`, detect runtimes and package managers, preserve supplementary evidence from `pnpm-workspace.yaml`, `astro.config.ts`, and `docusaurus.config.ts`, and create schema-valid JSON governance documents plus fixed safe templates at `.agent/rules.md` and `.agent/context.ignore`.
- Preserve existing governance files unless `--force` is supplied, and report conflicts before replacing metadata.
- Extend `sibyl check` with local manifest and lockfile parsing, dependency extraction, local registry/invariant policy evaluation, dense human-readable violation tables, JSON output, and non-zero status for violations or invalid evidence.
- Keep `sibyl check` strictly local. It must not execute project code, install dependencies, mutate the project, or call the backend API.
- Keep `sibyl sync` as the only network-capable command. Require an HTTPS endpoint, environment-provided authorization, validated episodic-memory or AST-skeleton payloads, bounded retries, secret-safe errors, and remote acknowledgement reporting.
- Add `sibyl memory add <title> <content> --category <category>` to validate and append a declarative memory entry without contacting a remote service.
- Add the Rust dependencies and integration-test dependencies needed for parsing, terminal tables, assertions, and temporary projects while retaining native Cargo ownership and the existing `sibyl` binary name.
- Add release-oriented CLI integration coverage for initialization, memory append, banned-package detection, read-only behavior, and invalid configuration.

## Capabilities

### New Capabilities

None. The existing CLI contract is owned by `rust-platform-services`, and the declarative memories document extends the existing shared schema contract.

### Modified Capabilities

- `rust-platform-services`: define the complete local workstation CLI behavior for multi-runtime initialization, dependency-policy checks, memory append, terminal/JSON diagnostics, and explicitly authorized synchronization.
- `shared-schemas`: include the versioned declarative `.agent/memories.json` document and its safe, non-executable memory entry contract.

## Impact

- Rust sources and integration tests under `apps/cli`.
- The root Cargo workspace dependency declarations and committed lockfile.
- The CLI Turborepo bridge and command documentation where needed to describe the final command and artifact contract.
- Local `.agent/` metadata generated inside inspected projects; the repository’s existing tracked governance files must remain protected by the explicit `--force` rule.
- The shared schema covers the generated JSON documents. `rules.md` and `context.ignore` remain fixed declarative templates with their safety constraints defined by the CLI contract.
- No backend API mutation or new remote endpoint is required. The existing HTTPS synchronization boundary remains the only remote path.
