# `sibyl` workstation CLI

The `sibyl` binary inspects project metadata locally and evaluates it against a
local registry snapshot. It does not execute project code, install dependencies,
resolve packages, or contact a service during `init`, `check`, or `memory add`.

## Commands

```text
sibyl init [--path <PROJECT>] [--force]
sibyl check [--path <PROJECT>] [--registry <SNAPSHOT>] [--json]
sibyl memory add <TITLE> <CONTENT> --category <CATEGORY> [--path <PROJECT>]
sibyl sync --payload <PAYLOAD>
```

`init` detects `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, and
`composer.json`. It also records `pnpm-workspace.yaml`, `astro.config.ts`, and
`docusaurus.config.ts` as supplementary evidence. It creates these governed
files under `.agent/`:

- `config.json`
- `rules.md`
- `skills.json`
- `memories.json`
- `context.ignore`

Initialization refuses to replace an existing owned file unless `--force` is
provided. `memory add` appends to `memories.json` in stable order and preserves
malformed existing documents when it refuses an update.

`check` reads manifests and lockfiles without dependency resolution. Use
`--registry` for a local snapshot, or set `SIBYL_REGISTRY_SNAPSHOT`; an explicit
`--registry` takes precedence. A project with dependencies but no local policy
source fails closed as `package policy is not configured`. Remote registry URLs
are rejected.

`--json` emits machine-readable diagnostics without ANSI escape sequences.
Human output includes package, severity, reason, and an approved replacement
shown as `banned -> approved`.

## Synchronization

`sync` is the only command that can contact a remote service. It requires:

```sh
export SIBYL_SYNC_ENDPOINT=https://sync.example.test/v1/sync
export SIBYL_SYNC_AUTH_TOKEN='local-value'
sibyl sync --payload ./payload.json
```

The endpoint must use HTTPS and must not contain credentials. Payloads must be
JSON schema version `1.0`, have kind `episodic-memory` or `ast-skeleton`, and
contain no credentials, private keys, or executable directives. Requests use a
bounded timeout and retry budget. The CLI reports success only after a
successful remote response.

## Build

From the repository root:

```sh
cargo build -p sibyl-cli --release --locked
```

The canonical release artifact is `target/release/sibyl`.
