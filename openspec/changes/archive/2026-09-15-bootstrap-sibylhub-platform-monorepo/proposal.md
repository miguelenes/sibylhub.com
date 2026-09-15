## Why

SibylHub needs one authoritative development environment for its public web, ecosystem backoffice, Rust API, workstation CLI, and technical documentation. Without a shared Turborepo/pnpm and Cargo foundation, the JavaScript, PHP, and Rust surfaces will drift in commands, contracts, dependency resolution, and validation, making the platform difficult to bootstrap and unsafe to evolve as an ecosystem source of truth.

## What Changes

- Establish a pnpm 9-managed Turborepo 2+ workspace with `apps/*` and `packages/*` discovery, root lifecycle scripts, deterministic task dependencies, and cache rules for mixed-runtime applications.
- Add a top-level Cargo workspace for the backend and CLI, including committed Rust dependency resolution and a shared root `target/` build location.
- Add `apps/web` as an Astro 5 + React 19 application with Cloudflare hybrid/SSR support through `@astrojs/cloudflare`, Tailwind styling, Wrangler configuration, and explicit D1, R2, and Vectorize binding contracts.
- Add `apps/backoffice` as a Laravel 11/12 application with Filament 5 and Laravel Boost, including the initial ecosystem source-of-truth model and export boundary for languages, runtimes, package managers, lockfiles, builders, stack invariants, and documentation.
- Add `apps/backend` as an Axum/Tokio Rust API server with Serde, SQLx, structured errors/logging, health and ecosystem endpoints, and stack-invariant validation boundaries.
- Add `apps/cli` as an independently runnable Clap/Tokio/Reqwest/Indicatif workstation CLI with `sibyl init`, `sibyl check`, and `sibyl sync` command contracts.
- Add `apps/docs` as a Docusaurus v3 TypeScript documentation site covering the workspace, `.agent/` governance, AST/Socraticode compression concepts, and Context7 architecture.
- Add `packages/schemas` for JSON Schema, Zod, PURL, ecosystem, `.agent/`, skill, and stack-invariant contracts.
- Add `packages/typescript-config` for shared TypeScript compiler definitions.
- Add `.agent/` governance and root/nested `AGENTS.md` guidance covering package ownership, setup, development, testing, formatting, deployment boundaries, security, and agent workflow rules.
- Add complete manifest/configuration templates, ignore rules, lockfile requirements, and local verification workflows without inventing credentials, fake Cloudflare resource identifiers, or unapproved production mutations.

## Capabilities

### New Capabilities

- `monorepo-orchestration`: The pnpm/Turborepo/Cargo workspace topology, root commands, task graph, caching policy, toolchain pinning, environment boundaries, and agent guidance.
- `shared-schemas`: Versioned JSON Schema, Zod, PURL, ecosystem, agent-configuration, skill, and stack-invariant contracts shared by the TypeScript, PHP, Rust, and documentation surfaces.
- `web-application`: The Astro 5/React 19 Cloudflare web application, rendering mode, UI integration, Wrangler bindings, local commands, and deployment configuration validation.
- `backoffice-ecosystem-source`: The Laravel/Filament 5/Boost backoffice and its ecosystem registry model, invariant data, public export command, and local validation boundary.
- `rust-platform-services`: The Axum backend API, health and ecosystem contracts, stack-invariant validation, and independent Clap workstation CLI workflows.
- `documentation-site`: The Docusaurus v3 TypeScript site, baseline documentation structure, static build artifact, and local documentation checks.

### Modified Capabilities

None. The repository has no existing main specifications.

## Impact

This change introduces the complete repository topology, root and package manifests, native dependency manifests and lockfiles, Turborepo and Cargo orchestration, Astro/React/Cloudflare configuration, Laravel/Filament application structure, Rust API and CLI boundaries, Docusaurus configuration, shared schema packages, `.agent/` governance, and validation documentation.

It also establishes future API and data contracts for ecosystem definitions, project agent configuration, skills, PURLs, and stack invariants. Product-specific authentication, authorization, persistence migrations beyond the initial registry foundation, external provider credentials, Cloudflare resource creation, DNS, production deployment, and live synchronization remain separately gated implementation or operations work.
