## Context

The repository currently contains OpenSpec configuration and the planning artifacts for this change, but no application source, package manifests, runtime configuration, or existing main specifications. The proposal and six capability specs define a cross-runtime foundation spanning pnpm/Turborepo, Cargo, Astro/React/Cloudflare, Laravel/Filament, Rust API and CLI processes, Docusaurus, shared schemas, and `.agent/` governance.

The design must preserve native dependency ownership while making the applications discoverable through one root task graph. It must also reconcile two deployment realities: Astro hybrid/SSR with `@astrojs/cloudflare` is a Cloudflare Workers shape, whereas `wrangler pages deploy ./dist` is a static Pages workflow. The selected design uses Workers for the web application and retains static publication for documentation.

## Goals / Non-Goals

**Goals:**

- Provide a conventional `apps/` and `packages/` topology with one clear owner for every runtime and contract.
- Make root development, build, test, lint, format, typecheck, coverage, and clean commands deterministic without replacing Composer or Cargo.
- Pin a compatible version set and commit all native lockfiles so a fresh checkout is reproducible.
- Establish a Cloudflare Workers web path with named D1, R2, and Vectorize bindings and an explicit no-implicit-deploy boundary.
- Make the Laravel backoffice the canonical registry editor and deterministic public-export producer.
- Keep the Rust backend and CLI independently runnable while sharing only explicit schema and configuration contracts.
- Make shared JSON Schema and Zod artifacts consumable by TypeScript and representable in PHP/Rust validation fixtures.
- Provide local/offline baseline checks that prove configuration, rendering, API, CLI, registry, and documentation behavior without production credentials.

**Non-Goals:**

- Creating Cloudflare accounts, D1 databases, R2 buckets, Vectorize indexes, DNS records, production secrets, or live deployments.
- Building product authentication, authorization policy, billing, user management, or a complete public application experience.
- Connecting the backend directly to the backoffice database; the registry crosses that boundary through versioned validated exports.
- Executing arbitrary repository code during `sibyl init`, schema validation, or registry auditing.
- Adding a shared UI package or a shared Rust domain crate before a concrete stable cross-application contract requires one.

## Decisions

### 1. Use a single workspace with native runtime boundaries

The repository will use this ownership layout:

```text
.
├── .agent/
├── apps/
│   ├── web/
│   ├── backoffice/
│   ├── backend/
│   ├── cli/
│   └── docs/
├── packages/
│   ├── schemas/
│   └── typescript-config/
├── Cargo.toml
├── Cargo.lock
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── turbo.json
```

The root Cargo workspace will list `apps/backend` and `apps/cli` and use resolver 2, giving both binaries one root `target/` directory while leaving their source and public executable contracts separate. Each non-Node application will have a minimal `package.json` adapter so Turborepo can schedule it; the adapter will call Composer or Cargo and will not represent PHP or Rust dependencies as pnpm packages. The backoffice will retain its own `composer.json`, `composer.lock`, frontend manifest, and Vite configuration.

Alternative considered: separate repositories would preserve runtime isolation but lose one task graph and make cross-runtime checks harder. A JavaScript-only workspace was rejected because Composer and Cargo are the authoritative resolvers for their ecosystems. A single combined Rust binary was rejected because the API server and workstation CLI need independent startup, configuration, and failure boundaries.

### 2. Pin a compatible baseline and let lockfiles capture transitive resolution

Direct dependencies will be written with exact versions in implementation manifests, and each ecosystem lockfile will be committed. The compatibility baseline selected from the package metadata checked during design is:

| Area | Baseline | Rationale |
| --- | --- | --- |
| Node runtime | Node 20 LTS, with the repository minimum recorded explicitly | Satisfies Docusaurus v3 and the selected Astro/Cloudflare toolchain without requiring separate Node versions |
| Package manager | pnpm 9.15.9 | Latest available pnpm 9 patch observed during design and compatible with the requested pnpm 9 line |
| Orchestrator | turbo 2.10.13 | Current stable Turborepo 2 line observed during design; uses the `tasks` schema |
| Root tooling | prettier 3.9.6, TypeScript 5.9.3 | Stable root formatting/typecheck baseline with broad ecosystem compatibility |
| Web | Astro 5.18.2, `@astrojs/react` 4.3.1, `@astrojs/cloudflare` 12.6.13, React/React DOM 19.2.0 | The Cloudflare adapter version peers with Astro 5 and the React integration supports React 19 |
| Web styling | Tailwind CSS 4.3.3, `@tailwindcss/vite` 4.3.3, HeroUI React/Styles 3.2.5 | Tailwind v4 and HeroUI v3 are the selected UI contracts |
| Cloudflare tooling | Wrangler 4.59.2, aligned with the selected Astro Cloudflare adapter | Keeps local Worker preview and deployment tooling on the adapter’s compatible line |
| Documentation | Docusaurus core/preset classic 3.10.2 and `@mdx-js/react` 3.1.1 | Docusaurus v3 TypeScript/static build baseline with React 19 peer compatibility |
| PHP | PHP 8.3+, Laravel 12.69.2, Filament 5.8.1, Laravel Boost 2.9.0 | Chooses Laravel 12 within the requested 11/12 range and matches the current Filament/Boost compatibility lines |
| Rust | Axum 0.7 line, Tokio 1.40 line, Serde 1.x, SQLx 0.8 line, Tower HTTP 0.6 line, Clap 4.x, Reqwest 0.12 line, Indicatif 0.17 line | Preserves the requested API/CLI baseline while avoiding an unreviewed major upgrade during bootstrap |

The Rust and PHP direct version lines will be resolved to exact compatible patch versions during implementation, recorded in `Cargo.lock` and `composer.lock`, and checked with the selected toolchain. No manifest will use a `latest` tag. If the selected exact versions cannot satisfy the stated runtime constraints, implementation must stop at that dependency gate rather than silently changing major versions.

### 3. Use current Turborepo task semantics and thin adapters

The root `package.json` will expose:

- `dev`: `turbo run dev --parallel`
- `dev:web`: `turbo run dev --filter=web`
- `dev:backend`: `turbo run dev --filter=backend`
- `build`, `test`, `lint`, `typecheck`, `test:cov`, `clean`, and a non-mutating configuration check
- `format`, implemented as a dispatcher rather than one invalid formatter command

The `turbo.json` contract will use `tasks`, not the deprecated `pipeline` key. `build` will depend on `^build` and declare the web, docs, backoffice asset, and root Cargo release outputs. `test` will depend on `^build` where generated artifacts are required. `dev` will be persistent with caching disabled. Deployment, remote publication, database migration, and other side-effecting tasks will be uncached and will not be prerequisites of persistent tasks.

Root input configuration will include package manifests, native lockfiles, TypeScript/configuration files, `.agent/` contracts, and declared environment-shape files so a relevant change invalidates the correct task. The Rust release outputs will be named separately (`backend` and `cli`) under the shared root `target/release/` directory, avoiding output collisions.

The root `format` task will invoke Prettier only for formats it owns (TypeScript, TSX, Astro, JSON, and Markdown), Laravel Pint for PHP, and `cargo fmt` for Rust. The requested broad `prettier --write` glob over `php` and `rs` is rejected because Prettier is not the authoritative formatter for either language and can silently produce incorrect results.

Alternative considered: treating every application as a normal Node package would make the graph appear simple but would hide Composer/Cargo failures and duplicate dependency ownership. A single root shell script was rejected because it would lose package-level cache identity and failure attribution.

### 4. Deploy Astro hybrid/SSR through Cloudflare Workers

The web app will use `@astrojs/cloudflare` with a hybrid/SSR output mode and Wrangler Worker commands:

- local development through the Astro server and/or `wrangler dev` against the generated Worker shape;
- local preview through Wrangler’s Worker preview path;
- a separate, explicit deployment command using `wrangler deploy`.

`wrangler pages dev ./dist` and `wrangler pages deploy ./dist` will not be the production path for this application because they describe static Pages output, not an Astro server Worker. Docusaurus remains a separate static artifact and can use a static host workflow later.

The web configuration will declare the named bindings `DB`, `AST_STORAGE`, and `VECTORIZE_INDEX`. Local configuration validation will check binding names, output mode, and required target shape without contacting Cloudflare. Production resource identifiers will be supplied through an explicitly selected Wrangler environment or deployment input; fake IDs, credentials, and account defaults will never be committed. A missing remote target will fail before the deploy command contacts Cloudflare.

The baseline route will not require any binding to render. Binding access will sit behind small request-time interfaces so local tests can use deterministic doubles, while production handlers can use D1, R2, or Vectorize through the Cloudflare environment. This keeps the platform wiring present without making local bootstrap depend on remote resources.

### 5. Use Tailwind v4 and HeroUI v3 without a compatibility layer

Tailwind v4 will be integrated through `@tailwindcss/vite` and CSS-first imports. The implementation will not add the older `@astrojs/tailwind` integration merely to match a package name from the initial brief, because the v4 toolchain has a different supported integration path. HeroUI v3 will be imported narrowly in React islands, use semantic variants and accessible handlers, and will not add a provider or v2 compatibility API.

Astro templates will contain ordinary content and layout. React 19 will be hydrated only for controls that require browser state. The baseline interactive control will be a small accessibility-tested example, not a global client-side application shell.

Alternative considered: a fully hydrated React application would simplify component composition but would violate the server-first performance boundary. HeroUI v2/provider compatibility was rejected because it would introduce the wrong API contract and migration debt.

### 6. Make Laravel 12 and Filament 5 the registry editing boundary

The backoffice will be created through the Laravel installer using PHP 8.3+, then configured with Laravel 12, Filament 5, and Laravel Boost. Filament resources and panel configuration stay inside `apps/backoffice`; the root workspace only invokes native Composer, Artisan, and Vite commands.

The registry will use a normalized, revision-aware relational model. Its stable identities will cover the 25 target languages, runtimes, package managers, lockfile specifications, builders, stack invariants, and documentation references, with explicit compatibility relationships and revision metadata. The model will validate against the shared schema contracts before a revision becomes exportable. The backend will not connect directly to this database, avoiding shared migrations and hidden coupling.

`php artisan registry:export-public` will select a valid revision, sort records by stable identity, serialize schema-versioned JSON, and write a local R2-compatible export tree. The command will be deterministic and side-effect-free with respect to remote storage. A separately explicit publish operation can upload an already-reviewed export when deployment credentials and target configuration are present; ordinary tests and local exports will never publish implicitly.

SQLite or another documented ephemeral local database will back baseline tests. Production database choices and migrations will be owned by the backoffice and must not be inferred by the Rust service.

Alternative considered: storing the canonical registry as hand-edited JSON would simplify the first commit but would not provide relational compatibility validation, revision history, or Filament administration. Sharing the backoffice database with the backend was rejected to keep schema ownership and deployment lifecycles independent.

### 7. Use versioned exports as the Rust/backend boundary

The backend will be a Cargo package with a small library boundary and a server binary. Its conceptual modules are configuration, HTTP routing, schema-aware registry snapshots, invariant evaluation, operational persistence, and error/telemetry handling. It will use Axum/Tokio, Serde, SQLx, Tower HTTP, structured tracing, `thiserror` for typed library/request errors, and `anyhow` only at binary orchestration boundaries.

The backend will expose:

- `GET /healthz` for readiness;
- `GET /v1/ecosystems` for the current validated schema-versioned registry snapshot; and
- a documented invariant-validation request/response endpoint under `/v1/invariants/validate`.

The canonical registry enters the backend as a validated versioned export or configured local snapshot. SQLx is reserved for backend-owned operational state such as synchronization metadata and cache bookkeeping, not for reading Laravel-owned tables. Health and schema-fixture tests remain runnable without a database or remote object store; production synchronization fails explicitly when its required state store is unavailable.

The CLI will be a separate Cargo package and executable. `sibyl init` reads supported manifest files without executing project code and writes valid `.agent/` metadata only after conflict checks. `sibyl check` is read-only and returns stable invariant diagnostics. `sibyl sync` validates episodic-memory and AST-skeleton payloads, requires an explicit endpoint and authorization configuration, and reports remote acknowledgement/revision or failure without claiming convergence from a timeout.

Alternative considered: making the CLI a server subcommand would share more code but would entangle configuration, network behavior, and release artifacts. A direct backend-to-Laravel database connection was rejected for the same ownership reason described above.

### 8. Treat `packages/schemas` as the contract source and avoid duplicate definitions

`packages/schemas` will contain versioned JSON Schema files as the language-neutral source and a TypeScript/Zod interface for local validation. It will define ecosystem documents, `.agent/config.json`, `.agent/skills.json`, stack-invariant rules, and PURL normalization. Fixture exports generated from these schemas will be consumed by PHP and Rust tests rather than recreating the same contract independently in each language.

The ecosystem catalog will contain an explicit stable identity for each of the 25 target languages and relationships to runtime, package manager, lockfile, builder, invariants, and documentation. Declarative `.agent/` files will be schema-validated and will reject credentials, private keys, and executable directives. Schema version incompatibility will fail closed.

`packages/typescript-config` will provide shared compiler settings for the TypeScript applications and packages. It will not contain runtime code or hidden build behavior.

### 9. Keep Docusaurus static and documentation executable-command aware

The docs app will use Docusaurus v3 with the TypeScript classic preset. Its first content set will document the monorepo tree, package ownership, root commands, `.agent/` governance, shared schemas, AST/Socraticode compression concepts, Context7 architecture, and the difference between local and remote evidence.

Its production output remains a self-contained static `build/` directory. Documentation checks will validate internal links and configuration before publication and will not start or call the backend, database, Cloudflare bindings, or synchronization service.

### 10. Make security and validation boundaries explicit in the repository

The root and nested `AGENTS.md` files will be generated as maintained project guidance, while `.agent/` remains the platform’s declarative project-governance directory. They will document:

- which files belong to each runtime;
- which package-specific and root checks are required;
- which commands are local-only and which can mutate remote state;
- how real environment files and Cloudflare credentials are excluded; and
- why local build success does not prove remote deployment or service convergence.

CI-ready validation will install from committed lockfiles, inspect the Turborepo graph, run focused native checks, and then run the root gates. Coverage will be an explicit per-runtime task; unavailable optional coverage tooling will be reported as a distinct gate rather than silently equated with ordinary tests.

## Risks / Trade-offs

- [Mixed-runtime adapters can hide native failures] → Keep adapters thin, preserve native exit codes and output, and run native commands directly in focused checks before relying on root orchestration.
- [Astro Cloudflare adapter and Wrangler versions can drift] → Pin the compatible Astro 5/adapter/Wrangler line, run a local Worker build/preview check, and keep the deploy command separate from build.
- [Static Pages examples can be copied into an SSR Worker project] → Document `wrangler dev`/`wrangler deploy` as the web path and reserve Pages-style static publishing for Docusaurus.
- [Tailwind v4 and HeroUI v3 can be paired with legacy integration APIs] → Validate the manifests and source for the v4 Vite plugin, HeroUI v3 package line, no provider, and no v2 imports.
- [Installer output can change across Laravel releases] → Select Laravel 12 explicitly, pin Composer dependencies, commit `composer.lock`, and verify Filament/Boost compatibility before registry work.
- [A broad registry model can become untestable] → Start with stable identities, normalized relationships, schema fixtures, deterministic exports, and a small initial panel; defer product workflows.
- [Backend and backoffice can drift if each invents a registry shape] → Make versioned JSON Schema exports the boundary and test the same fixtures in TypeScript, PHP, and Rust.
- [CLI synchronization can report success before remote convergence] → Require explicit acknowledgements/revisions, classify transport timeouts as failures, and never log authorization material.
- [Root coverage semantics differ across ecosystems] → Keep `test:cov` as an explicit aggregate/adapter contract and report missing drivers separately from test failures.
- [Cloudflare binding names can be correct while targets are wrong] → Require explicit environment selection and resource identifiers for remote operations, validate locally first, and never invent IDs or use account defaults.
- [Shared root Cargo `target/` outputs can collide] → use distinct binary names and explicit Turborepo output paths for `backend` and `cli`.

## Migration Plan

This is a greenfield bootstrap, so there is no production data migration. Implementation will proceed in dependency order:

1. Record the selected runtime versions and create root pnpm/Cargo/Turborepo manifests, ignore rules, environment-shape files, and governance guidance.
2. Create the shared schema and TypeScript configuration packages, fixtures, and validation scripts.
3. Scaffold and lock the Astro/React/Cloudflare web app, then validate the Worker build and binding shape locally.
4. Scaffold and lock Laravel 12/Filament 5/Boost, create the initial registry model/export path, and run local panel and database tests.
5. Create the Cargo backend/CLI workspace, implement health/API/invariant/config contracts, and run offline Rust checks.
6. Scaffold the Docusaurus site and document the actual commands and boundaries.
7. Connect adapters to the root task graph, run focused gates, then run root build/test/lint/typecheck/coverage/format checks and inspect cache behavior.

The rollback path before adoption is a version-control revert of this scaffold, with no remote resources to clean up. If implementation reaches a failed dependency or runtime gate, the affected package remains unclaimed until its native failure is resolved; root commands must not bypass it. Any later Cloudflare deployment or public registry publication requires a separate authorized operational step and independent readback.

## Open Questions

None block the architecture or task breakdown. Actual Cloudflare account/resource identifiers are deployment inputs that can be supplied when a remote deployment is explicitly authorized; they are not needed for local schema, build, or binding-shape validation.
