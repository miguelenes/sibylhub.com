## 1. Workspace and toolchain foundation

- [ ] 1.1 Record supported Node/pnpm, PHP/Composer, Rust/Cargo, and system prerequisites in root documentation, pin the package manager in the root manifest, and verify the documented versions are discoverable with the corresponding version commands
- [ ] 1.2 Create the pnpm workspace manifest and `apps/` package boundaries for `web`, `backoffice`, `backend`, `cli`, and `docs`, adding only the minimal package manifests needed for Turborepo task discovery; verify workspace package discovery with `pnpm list --depth -1` or the repository's equivalent
- [ ] 1.3 Add the root Turborepo configuration using the current `tasks` schema, explicit build inputs/outputs, topological build dependencies, uncached persistent development tasks, and uncached side-effecting tasks; verify the graph with `pnpm turbo run build --dry`
- [ ] 1.4 Add root scripts for `dev`, `build`, `lint`, `typecheck`, `test`, `test:cov`, `clean`, and configuration validation, then verify each script resolves to a known workspace task without executing a deployment
- [ ] 1.5 Add root ignore rules and non-secret environment templates for Node, Laravel, Rust, Docusaurus, and Wrangler state; verify tracked example files contain placeholders only and actual environment/dependency/build directories are ignored
- [ ] 1.6 Create root and nested agent guidance covering application ownership, native commands, required focused/root gates, cache boundaries, secrets, and local-versus-remote evidence; verify each guidance file points to commands and paths that exist in the scaffold

## 2. Astro and React web application

- [ ] 2.1 Scaffold `apps/web` with the supported Astro TypeScript starter and React integration, keeping static output as the initial rendering mode; verify `pnpm --filter web astro check` or the generated equivalent passes
- [ ] 2.2 Install and configure React 19, HeroUI v3, Tailwind CSS v4, and the required Astro styling integration using current official documentation; verify the manifest has no legacy HeroUI provider/v2 dependency and a minimal component compiles
- [ ] 2.3 Implement the baseline public route with static Astro markup and one narrowly scoped interactive React island using semantic HeroUI v3 components and accessible labeling; verify the focused render/component test passes and the built HTML contains the baseline route
- [ ] 2.4 Add web scripts for development, build, typecheck, lint, test, and coverage, with focused tests that do not require a live backend; verify each script returns a meaningful result in the web directory
- [ ] 2.5 Add explicit Wrangler configuration and a local configuration/build validation command for the generated static output, with target identifiers supplied only through environment/configuration; verify the check fails closed when the target is absent and performs no remote mutation
- [ ] 2.6 Run the web production build and inspect its output for the baseline route, unresolved imports, and unexpected broad client hydration; verify the output directory is non-empty and matches the Wrangler target directory

## 3. Laravel and Filament backoffice

- [ ] 3.1 Create `apps/backoffice` with the supported Laravel installer workflow and local test configuration, retaining Laravel's Composer and frontend manifests inside the app; verify `php artisan about` and the local application boot command succeed
- [ ] 3.2 Install and configure Filament 5 through its supported panel installation workflow without adding product resources; verify `php artisan route:list` shows the configured panel route and a request returns the panel shell or an explicit authentication response
- [ ] 3.3 Add the backoffice's Turborepo adapter scripts for development, asset build, lint/format, typecheck where applicable, test, coverage, clean, and route/config inspection; verify native Composer/npm commands preserve their exit codes through the adapter
- [ ] 3.4 Add safe Laravel environment examples and local-only state rules, then verify a credential scan over tracked files finds no password, token, private key, or live database credential
- [ ] 3.5 Add baseline Laravel/Pest or PHPUnit tests for application boot and panel routing using local/ephemeral test state; verify the focused suite passes without a production database, queue, or external provider
- [ ] 3.6 Run the documented PHP formatting/lint and application test checks, including coverage when the required local coverage driver is available; verify unavailable optional coverage tooling is reported distinctly rather than treated as a passing coverage result

## 4. Rust backend and CLI

- [ ] 4.1 Create a Cargo workspace containing independent `apps/backend` and `apps/cli` packages with committed manifests and lockfile, and add thin Turborepo adapter manifests/scripts; verify `cargo metadata --locked` discovers both packages
- [ ] 4.2 Implement backend configuration parsing, structured tracing, typed startup/request errors, and an HTTP API/webserver entry point with a stable local health endpoint; verify an in-process or local request returns the documented successful JSON shape
- [ ] 4.3 Add backend malformed-input handling and secret-safe error/log serialization; verify a focused request test returns the documented client-error shape without terminating the server and a startup failure exits non-zero without secret leakage
- [ ] 4.4 Implement the independent CLI's `--help`, version, configuration parsing, and non-mutating bootstrap behavior; verify help/version exit successfully and invalid commands/configuration exit non-zero without network or state-changing work
- [ ] 4.5 Add Rust scripts for format check, Clippy, build, tests, coverage where supported, and clean; verify `cargo fmt --check`, `cargo clippy --all-targets --all-features --locked -- -D warnings`, `cargo test --locked`, and the locked build pass offline or classify any external prerequisite explicitly

## 5. Docusaurus documentation site

- [ ] 5.1 Scaffold `apps/docs` with the supported Docusaurus TypeScript starter and local development command; verify the baseline route renders and the generated configuration uses TypeScript
- [ ] 5.2 Add concise workspace, application-boundary, setup, validation, caching, and deployment-boundary documentation with valid internal navigation; verify the content names the actual root/package commands and excludes secrets
- [ ] 5.3 Add docs scripts for development, static build, typecheck, lint/format, test/validation, and clean; verify the production build emits a non-empty self-contained static artifact and fails on broken links/configuration

## 6. Cross-runtime integration and finish gates

- [ ] 6.1 Connect each application adapter to the root Turborepo task graph with package-specific outputs and inputs, verify `pnpm turbo run build --dry` shows the intended order, and verify no persistent task has dependents
- [ ] 6.2 Verify root setup from a clean dependency state using committed lockfiles and documented local environment examples; verify installation completes without production credentials and all expected workspace packages are discoverable
- [ ] 6.3 Run focused checks for web, backoffice, backend, CLI, and docs, then run root `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, and `pnpm build`; record each result independently and confirm build outputs exist
- [ ] 6.4 Verify cache behavior by repeating a reproducible build and changing one declared input, then inspect the task summary; confirm the unchanged task can hit cache and the changed task invalidates without caching dev/deploy work
- [ ] 6.5 Review the final tree, lockfiles, ignore rules, environment templates, generated outputs, and agent guidance for misplaced dependencies or secrets; verify no production deployment, Cloudflare mutation, database provisioning, or external service call was performed
