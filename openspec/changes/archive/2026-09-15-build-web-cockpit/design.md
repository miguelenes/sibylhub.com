## Context

The proposal defines the motivation and feature boundary. The current web app is an Astro 5 Cloudflare Worker scaffold with a server-rendered baseline route, one small React island, optional `DB`, `AST_STORAGE`, and `VECTORIZE_INDEX` bindings, and a local `wrangler dev --local` preview path. The app does not currently have a D1 schema for cockpit data or an AI binding.

`@sibylhub/design-system` already provides the semantic tokens and telemetry primitives required by the cockpit. `@sibylhub/schemas` already validates declarative skills, memories, PURLs, and registry artifacts. There is no `@sibylhub/api-client` package. The Rust backend provides deterministic context-budget and invariant APIs, while Laravel remains the registry source of truth and must not be queried directly by the web app.

See `proposal.md` and `specs/web-cockpit/spec.md` for the motivation and observable requirements.

## Goals / Non-Goals

**Goals:**

- Provide a stable SSR and browser-interaction boundary for the cockpit.
- Define versioned, bounded contracts for project context and semantic memory retrieval.
- Keep local rendering and validation deterministic when Cloudflare resources are absent.
- Reuse shared design tokens and schema validators without introducing a legacy Tailwind configuration.
- Keep dependency audit results evidence-based and keep skill changes as explicit local drafts.
- Make the hot request paths predictable for Cloudflare Free Tier CPU and subrequest limits.

**Non-Goals:**

- Adding product authentication, user accounts, or a new authorization system.
- Connecting the web app directly to Laravel tables or making remote registry publication implicit.
- Mutating `.agent/skills.json` from a deployed Worker.
- Building a general-purpose memory editor, embedding reindexer, dependency scanner, or background synchronization service.
- Making D1, R2, Vectorize, Workers AI, or a live Rust backend mandatory for the baseline page or local test suite.

## Decisions

### Use Astro hybrid output with an Astro-owned shell

The app will use the requested `astro.config.mjs` and configure Astro for hybrid behavior with the Cloudflare adapter. Public or static-safe document content can be prerendered, while the cockpit and API endpoints remain server-capable. `CockpitLayout.astro` will own the document structure, navigation, project selector, initial status labels, and responsive layout. React will remain limited to the four focused islands.

The existing `astro.config.ts` will be replaced by the requested `.mjs` file rather than leaving two configurations. The Worker preview remains `wrangler dev --local`; Pages commands are excluded because this application produces a server Worker.

### Share a typed boundary without making the browser a backend client

Create `packages/api-client` as a small workspace package containing versioned DTOs and secret-safe request helpers for the two web routes. It may also expose typed helpers for existing Rust APIs for optional, explicitly invoked ingestion and contract compatibility, but the cockpit page and read routes will not call the Rust backend. The package will not contain Cloudflare bindings or credentials. The server route will use the same contract types as the browser islands, while server-side page loading will call the route service directly rather than making a request back to its own origin.

Cockpit DTOs remain web-owned because no other runtime currently consumes them. The package will reuse `@sibylhub/schemas` validators and types for skills, memories, PURLs, and registry records. A future cross-runtime consumer can promote a contract into `packages/schemas` through a separate change.

### Define additive, web-owned D1 tables

Add an additive local migration for bounded, normalized records:

- `project_context_snapshots` stores project identity, source revision, context ceiling, five current usage values, and optional RTK savings.
- `project_dependencies` stores project-scoped package identity, version or PURL data, runtime and package-manager evidence, snapshot revision, and the latest policy result.
- `memory_entries` stores project-scoped memory identity, title, category, bounded content preview, source revision, and a persisted access counter. Vectorize metadata stores the memory identifier used for hydration.

The route service will use parameterized queries, stable project identifiers, explicit row limits, and a bounded list of Vectorize identifiers. D1 is the source for project metadata, precomputed dependency policy evidence, and approved memory metadata. Dependency policy is evaluated before snapshot ingestion through the existing invariant boundary; the cockpit read path does not perform an online Rust invariant call. R2 remains the optional source for larger AST artifacts and is not read on every context request; the snapshot records the relevant revision or key when one exists.

The local binding doubles will return the deterministic project snapshot with `source: "local"`. When optional semantic bindings are absent, the default memory path returns the specified unavailable state. A separate explicit test fixture may simulate a successful empty search result. The doubles will not pretend to contain live registry, vector, or memory data.

### Keep budget allocation deterministic and compatible with the Rust contract

Implement one small pure allocation function in the web-owned contract layer with the existing weights: Rules 10%, Memories 15%, AST 35%, Active 30%, and Tools 10%. It will use the same largest-remainder rule as `POST /v1/context/budget`, with golden cases for small ceilings and zero usage. The context route will calculate allocated partition values from the stored ceiling and return actual usage separately. This keeps the browser independent of a backend round trip while tests detect drift from the established contract.

The quota state mapping will be centralized in the same contract layer and will preserve the existing design-system thresholds. The default RTK savings value is `-74.2%` and is marked as a default in the response when the source omits it.

### Make the initial page data the hydration input

The server page loader will obtain one bounded project context snapshot and pass only serializable, display-safe data to the islands. `ContextObservatory`, `DependencyAuditView`, and the initial state of `FastMcpSkillCatalog` will render from those props. `MemoryGraphViewer` will render a stable search prompt and no-results-unavailable distinction until the operator submits a query.

Each island will render the same initial state during hydration. Follow-up fetches will happen only after an explicit interaction or an intentional refresh. No client-only timestamp, random identifier, or loading placeholder will replace server content during hydration.

### Bound the memory query path

The memory endpoint will validate the request before touching a provider. It will cap query length at 256 characters and results at 10, run one Workers AI embedding request using `@cf/baai/bge-small-en-v1.5`, issue one Vectorize query, and hydrate only the returned identifiers from D1. It will return titles, categories, bounded previews, similarity scores, and read-only access counters. Counter mutation and reindexing are outside this change.

Workers AI is declared as an optional `AI` binding. Missing AI, Vectorize, or D1 resources produce the stable unavailable contract. Upstream exception text and query contents are not logged or returned. The endpoint uses private or no-store response semantics because memory metadata is operator data.

### Make dependency and skill state fail closed

Dependency evidence will come from the D1 snapshot, which contains the result of an upstream invariant-evaluation boundary. The view will show compliant status only when approved identity and required evidence are present. The cockpit read path will not call the Rust invariant endpoint, so missing, stale, or unavailable evidence is represented separately from a passing result. Typed Rust helpers remain available for separately authorized ingestion or contract tests.

The audited skill catalog will be a versioned, validated input owned by the web package until a first-party Rosie/FastMCP source is established. The current repository contains no such source, so implementation will not invent audited entries. Entries without both audited and declarative markers are display-only. The browser draft is validated with the existing `SkillsDocument` contract and exported in stable order. Applying the exported file remains an explicit `sibyl` CLI operation.

### Use the design-system CSS-first token contract

Import `@sibylhub/design-system/tokens` from the app stylesheet alongside Tailwind v4 and HeroUI styles. The design-system token stylesheet already declares the semantic HSL channels and `@theme inline` utilities required by the app. The exported JavaScript Tailwind preset remains available to legacy consumers but will not be wired through a new `tailwind.config.*` file in this Tailwind v4 application.

The layout will use semantic utilities, existing gauge and status components, Lucide iconography through the design system, and reduced-motion utilities. Above-the-fold islands will use `client:visible` as requested, while their server-rendered output prevents a blank first paint.

### Validate locally and deploy separately

Add route and contract tests with mocked bindings, SSR output checks, schema rejection cases, accessibility assertions, and island interaction tests. Keep the existing web commands and add only the package-specific dependencies needed for those checks. `pnpm validate`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm preview` remain local gates. Remote D1 migration, resource creation, AI model availability, Vectorize index configuration, and `pnpm deploy` remain separately authorized operations with independent readback.

## Risks / Trade-offs

- [Risk] D1 records or Vectorize metadata drift from the expected versioned shape. → Validate every row at the route boundary, return a stable unavailable error for invalid records, and include source revisions in responses.
- [Risk] The web budget allocator drifts from the Rust implementation. → Keep the same weights and largest-remainder algorithm, share golden vectors in tests, and treat a mismatch as a failed contract check.
- [Risk] Memory data could be exposed if the Worker is placed on a public hostname. → Keep the feature local or behind an existing external access-control boundary until product authorization is designed; this change adds no public identity system.
- [Risk] Workers AI or Vectorize availability varies by environment. → Make `AI` optional, keep the baseline route binding-independent, and show unavailable state instead of fabricated results.
- [Risk] No audited Rosie/FastMCP catalog source is present. → Fail closed with an explicit unavailable or empty catalog state and do not mark local project skills as audited without source evidence.
- [Risk] A dense observatory layout can overflow on small screens or rely on color alone. → Test at a 320 CSS pixel viewport, use readable state text and focus styles, and honor reduced-motion preferences.
- [Risk] A D1 migration can be applied without populated source data. → Make migrations additive and safe for empty tables, keep local fixtures deterministic, and treat population and remote migration as separate operations.

## Migration Plan

1. Add the package, route contracts, local migration, optional AI binding declaration, and SSR cockpit implementation.
2. Run local schema and application checks with deterministic doubles and without Cloudflare credentials.
3. Build the Worker and run the local Wrangler preview. Confirm the baseline page and unavailable states before configuring live services.
4. Separately authorize and apply the D1 migration, populate project and memory metadata, configure the Vectorize index and Workers AI binding, and read back each resource.
5. Put the deployed cockpit behind the approved external access boundary, then run the guarded deployment command and verify the deployed Worker independently.

Rollback removes the cockpit route from the active page and stops using the new tables. The additive tables and stored snapshots can remain for recovery; no existing registry or `.agent` files are overwritten by this change.
