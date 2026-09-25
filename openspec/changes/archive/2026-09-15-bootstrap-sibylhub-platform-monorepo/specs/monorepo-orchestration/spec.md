## Purpose

Define one reproducible workspace contract that lets JavaScript, PHP, and Rust applications share developer workflows without collapsing their native dependency or runtime boundaries.

## ADDED Requirements

### Requirement: The workspace exposes explicit application and package ownership

The repository SHALL expose `apps/web`, `apps/backoffice`, `apps/backend`, `apps/cli`, and `apps/docs` as distinct application roots, SHALL expose `packages/schemas` and `packages/typescript-config` as distinct shared-package roots, and SHALL document the runtime owner, dependency manager, local command, and build artifact for each root.

#### Scenario: A new contributor discovers the workspace

- **WHEN** the contributor follows the root workspace documentation
- **THEN** they can identify every requested application and shared package, its owning toolchain, its local development command, and its generated output without inspecting dependency directories

### Requirement: Root commands provide a stable orchestration contract

The workspace SHALL provide root commands for parallel development, web-only development, backend-only development, production builds, tests, coverage tests, linting, type checking, formatting, cleaning, and non-mutating configuration validation. Each command SHALL route only to packages that implement the corresponding task and SHALL preserve the failing package and task in its exit result.

#### Scenario: A root validation command is run

- **WHEN** an engineer runs the documented root validation commands
- **THEN** the relevant application checks execute without manual directory changes and a failure identifies the owning package and task

### Requirement: The task graph preserves dependency and cache correctness

The orchestration SHALL run dependent package builds before consumers, SHALL include source, configuration, lockfile, and declared toolchain inputs in reproducible task identity, SHALL declare build artifacts explicitly, and SHALL never restore development servers or side-effecting deployment, database, or remote-publish tasks from cache.

#### Scenario: A reproducible build is repeated

- **WHEN** the source, configuration, lockfiles, and declared inputs are unchanged
- **THEN** a previously produced build artifact can be restored from cache, while changing a relevant input invalidates the affected task

#### Scenario: Development and publication tasks are invoked

- **WHEN** an engineer starts a development server or invokes a remote publication operation
- **THEN** the task remains live or executes as a fresh side effect and is not treated as completed cached work

### Requirement: Native dependency managers remain authoritative

The workspace SHALL use pnpm 9 for JavaScript/TypeScript dependency resolution, a top-level Cargo workspace and committed Cargo lockfile for Rust resolution, and the backoffice's Composer lockfile for PHP resolution. JavaScript manifests used to bridge non-Node applications SHALL invoke native commands rather than duplicate native dependency graphs.

#### Scenario: Dependencies are installed from a fresh checkout

- **WHEN** an engineer installs dependencies using the documented lockfile-based setup
- **THEN** pnpm, Composer, and Cargo resolve from their committed manifests and lockfiles without requiring a production service or secret

### Requirement: Governance and secret boundaries are discoverable

The repository SHALL contain `.agent/` governance files plus root and applicable nested `AGENTS.md` guidance describing safe commands, package boundaries, required validation gates, and the distinction between local evidence and remote runtime evidence. Tracked configuration SHALL contain no credentials, private keys, or fabricated production resource identifiers.

#### Scenario: An agent is asked to change one application

- **WHEN** the agent reads the closest applicable guidance file
- **THEN** it can determine the allowed package scope, required focused and root checks, prohibited cross-application actions, and secret-handling rules
