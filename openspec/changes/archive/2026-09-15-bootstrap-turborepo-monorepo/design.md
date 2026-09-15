## Context

The repository currently contains only the OpenSpec project configuration and an empty specs directory. The requested change spans five applications and three runtime ecosystems: pnpm/Turborepo for orchestration, Astro/React for the web, Laravel/Filament for the backoffice, Cargo for backend and CLI, and Docusaurus for documentation. See `proposal.md` for motivation and the capability contracts under `specs/` for required behavior.

## Goals / Non-Goals

**Goals:**

- Establish a conventional, easy-to-navigate `apps/` layout with one application boundary per requested surface.
- Make each runtime independently developable and testable while exposing a common root task vocabulary.
- Make builds and checks reproducible through committed manifests, lockfiles, explicit toolchain expectations, and safe environment examples.
- Provide a static-first Cloudflare deployment path for the Astro web and static publication for Docusaurus.
- Leave a small, testable backend health/API seam and CLI contract for later product work.

**Non-Goals:**

- Product domain models, persistence schemas, business workflows, authentication, authorization, or user-facing feature design.
- Production Cloudflare resources, DNS, access policies, database creation, deploys, or secret provisioning.
- Live service integrations, generated client SDKs, queues, background workers, or cross-application data synchronization.
- A shared UI package or a shared Rust domain crate before an actual shared contract is required; the initial scaffold keeps those boundaries explicit and small.

## Decisions

### Workspace layout and orchestration

Use pnpm workspaces with `apps/web`, `apps/backoffice`, `apps/backend`, `apps/cli`, and `apps/docs`. Add a minimal package manifest where a non-JavaScript runtime needs to participate in Turborepo; its scripts act as adapters to Composer or Cargo rather than moving PHP/Rust dependencies into the Node dependency graph. Keep any future reusable JavaScript packages under `packages/` and do not invent shared packages during bootstrap.

Use the current Turborepo task schema (`tasks`, not the deprecated `pipeline` spelling) with root tasks for `build`, `dev`, `lint`, `typecheck`, `test`, `test:cov`, `clean`, and a non-cached deployment/configuration check. Topological build dependencies use `^build`; tests depend on the package build only where the package needs generated output. Persistent `dev` tasks have `cache: false` and no dependents. This keeps the root command stable while each runtime retains its native toolchain.

Alternative considered: independent repositories or a JavaScript-only workspace. Both would obscure the requested cross-runtime workflow and make common validation harder. A single package manager for every dependency was rejected because Composer and Cargo have authoritative lock and resolution behavior of their own.

### Web runtime and Cloudflare target

Use Astro with the React integration and React 19, configured static-first for the initial public scaffold. Keep ordinary markup in Astro and hydrate only the small React islands that need interaction. Use HeroUI v3 with Tailwind CSS v4 and `@heroui/styles`; do not add a HeroUI provider or v2 compatibility layer. Use Wrangler to validate and publish the generated static output to the explicitly declared Cloudflare target. Keep the Cloudflare adapter out of the initial path unless a future requirement introduces request-time rendering; adding SSR merely because the deployment host supports it would make every page more dynamic without a current need.

Alternative considered: full SSR/hybrid Astro on Cloudflare. It remains available as a later, spec-backed change, but static output is the safer bootstrap default because no request-time data or authentication requirement exists.

### Backoffice runtime

Create `apps/backoffice` with the Laravel installer, then install Filament 5 through its supported panel installation workflow. Keep the Laravel package's own `composer.json`, `composer.lock`, frontend `package.json`, and Vite configuration inside that app. The root Turborepo adapter invokes native Laravel/Composer commands; it does not try to model PHP packages as pnpm workspace dependencies. Use a local test configuration and SQLite or another documented ephemeral test database only for baseline framework checks.

Alternative considered: placing Filament in a shared root PHP application or building the panel in React. Both violate the requested Laravel/Filament boundary and would make the backoffice's framework upgrade and security controls less independent.

### Rust backend and CLI

Use a Cargo workspace for `apps/backend` and `apps/cli`. The backend package contains the HTTP API/webserver binary and a small library boundary for configuration and request/error types only where the CLI genuinely needs them. Use Tokio and an HTTP framework selected during implementation, with `thiserror` for typed library/request errors and `anyhow` only at binary orchestration boundaries. Add structured tracing, explicit configuration parsing, a health endpoint, and offline baseline tests. The CLI remains a separate binary and does not inherit server-only state or perform network/state-changing work in its bootstrap commands.

Alternative considered: a single binary with subcommands. It would reduce files but would not satisfy the requested independently runnable CLI application or preserve a clean server/command boundary.

### Documentation runtime

Use the Docusaurus TypeScript starter in `apps/docs`, with concise workspace and application guides as the first content. Keep its build static and independent from the backend. Treat documentation link checking and TypeScript/config validation as local gates before any hosting work.

### Environment, secrets, and validation

Commit only `.env.example`-style files with placeholders and document which values are required for local-only optional features. Add ignore rules for actual environment files, build output, dependency directories, Laravel local state, Cargo target output, and Cloudflare credentials. CI should run dependency installation from lockfiles, the root task graph dry-run, root lint/typecheck/test/test:cov/build gates, and package-specific diagnostics where a runtime requires extra tooling. A passing local build is not evidence that a remote Cloudflare deployment or external service is configured.

## Risks / Trade-offs

- [Mixed-runtime task adapters can hide native failures] → Keep each adapter thin, preserve native command output and exit codes, and run native package commands directly in focused validation.
- [Installer-generated files may vary with current framework releases] → Pin compatible major versions during implementation, commit all generated lockfiles, record runtime versions, and verify the generated manifests before moving on.
- [Coverage aggregation across PHP, Rust, and TypeScript is not uniform] → Define `test:cov` as an explicit per-package contract, document required optional coverage tools, and report unavailable coverage providers as a distinct gate rather than silently treating ordinary tests as coverage.
- [Cloudflare deployment configuration may be syntactically valid but target the wrong resource] → Require an explicit non-secret target identifier, keep deployment side effects behind a separate command, and validate configuration locally before any authorized deploy.
- [React/HeroUI dependencies can increase the web bundle] → Keep the Astro shell static, hydrate only interactive islands, import components narrowly, and inspect the production build before adding broader client state.
- [The backend/CLI shared boundary can become a premature coupling point] → Start with only health/config/error contracts and add shared domain abstractions only when a later capability requires them.

## Migration Plan

This is a greenfield bootstrap, so there is no production migration. Implementation should create the workspace in dependency order, install and lock each native runtime, run focused package checks, then run the root task graph and static-build checks. Deployment is deliberately excluded. If the scaffold needs to be reverted before adoption, remove the change in version control and retain no generated credentials or remote resources; once adopted, future changes should migrate one application boundary at a time through separate OpenSpec changes.

## Open Questions

None that change the specified behavior or the bootstrap approach. Exact compatible patch versions and the eventual Cloudflare account/project identifiers can be selected during implementation and recorded in the committed manifests without changing these contracts.
