# SibylHub platform

SibylHub is a mixed-runtime workspace for a public Astro site, a Laravel registry backoffice, a Rust API, a Rust workstation CLI, and a Docusaurus documentation site. The shared schema package is the contract boundary between those runtimes.

## Workspace

```text
.
├── .agent/                  declarative project metadata and invariants
├── apps/
│   ├── web/                 Astro, React, Cloudflare Worker output
│   ├── backoffice/          Laravel, Filament, local SQLite registry source
│   ├── backend/             Axum API and schema snapshot reader
│   ├── cli/                 `sibyl` project analyzer and sync client
│   └── docs/                Docusaurus static documentation
├── packages/
│   ├── schemas/             JSON Schema, Zod validators, fixtures
│   ├── design-system/       shared Oracle & Engine tokens and React telemetry primitives
│   └── typescript-config/   shared TypeScript compiler settings
├── Cargo.toml               Rust workspace
├── package.json              pnpm and Turborepo entry points
├── pnpm-workspace.yaml      apps/* and packages/* discovery
└── turbo.json               task graph and cache policy
```

## Prerequisites and setup

Use Node 20.19.0 or a later Node 20 LTS release, pnpm 9.15.9, PHP 8.3 or later, Composer, and Rust 1.82 or later. The repository records these expectations in `.nvmrc`, `.node-version`, `rust-toolchain.toml`, and the package manifests.

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
composer install --working-dir=apps/backoffice --no-interaction
cargo build --workspace --locked
pnpm check:config
```

The environment examples contain shape only. Copy them to local environment files and add local values where a package requires them. Never put credentials or production identifiers in tracked files.

## Commands

| Command                 | Owner           | Local result                                                                                 |
| ----------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`              | Turborepo       | Starts package development processes in parallel                                             |
| `pnpm dev:web`          | `apps/web`      | Starts Astro development on port 4321                                                        |
| `pnpm dev:backend`      | `apps/backend`  | Starts the Rust API on `0.0.0.0:8080`                                                        |
| `pnpm build`            | Turborepo       | Builds schemas, design-system, web, backoffice assets, Rust release binaries, and docs       |
| `pnpm test`             | Turborepo       | Runs local package test suites                                                               |
| `pnpm test:cov`         | Turborepo       | Runs package coverage tasks and reports unavailable drivers separately                       |
| `pnpm lint`             | Turborepo       | Runs package lint and configuration checks                                                   |
| `pnpm typecheck`        | Turborepo       | Runs TypeScript, Astro, and Rust compile/type checks                                         |
| `pnpm format`           | root dispatcher | Checks Prettier-owned files, PHP with Pint when installed, and Rust with Cargo               |
| `pnpm format:write`     | root dispatcher | Formats files with their owning formatter                                                    |
| `pnpm clean`            | Turborepo       | Removes generated package output and local Rust/Turbo output                                 |
| `pnpm verify:contracts` | root dispatcher | Verifies generated schemas, deterministic fixtures, and cross-runtime contract shape offline |

Package manifests document native commands. `packages/design-system` is owned by pnpm, builds ESM/declaration output plus `dist/styles/globals.css`, and provides the shared token stylesheet to the Filament theme. `apps/web` previews the Worker shape through Wrangler, `apps/docs` emits `build/`, `apps/backoffice` uses Artisan and Composer while consuming frontend assets through pnpm/Vite, and Rust uses Cargo. `wrangler deploy`, registry publication, database migrations, and `sibyl sync` are explicit side-effecting commands and are never run by ordinary build or test tasks.

The workstation CLI command tree and its local registry/synchronization boundaries are documented in [`apps/cli/README.md`](apps/cli/README.md). Its release binary is `target/release/sibyl`.

## Evidence boundary

Passing local checks proves only that the checked-out source works in the local environment. It does not prove Cloudflare resources, DNS, production databases, remote storage, provider authentication, deployment, or synchronization convergence. Remote operations require a separately selected target, authorization, and readback.
