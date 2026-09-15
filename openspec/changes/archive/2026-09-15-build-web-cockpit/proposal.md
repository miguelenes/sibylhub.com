## Why

SibylHub has a server-rendered web scaffold, shared telemetry components, and local project governance files, but it does not yet give an operator one place to inspect context usage, memory retrieval, dependency policy, or available skills. The cockpit will turn those existing contracts into a usable web surface while keeping the first response server-rendered and keeping local validation independent of Cloudflare resources.

## What Changes

- Add a new Astro hybrid cockpit route with an Astro-owned shell and focused React 19 islands for the four interactive views.
- Add `CockpitLayout.astro` with project switching, a collapsible navigation treatment, dense telemetry styling, responsive behavior, and accessible state labels.
- Add `ContextObservatory.tsx` using `@sibylhub/design-system` telemetry primitives to show the five context partitions, active usage, quota state, and RTK savings.
- Add `MemoryGraphViewer.tsx` with bounded semantic search results, similarity scores, access counters, and an explicit empty or unavailable state.
- Add `DependencyAuditView.tsx` for active dependency evidence, approved and banned package policy, invariant severity, and replacement guidance.
- Add `FastMcpSkillCatalog.tsx` for the audited skill catalog. Toggles will update a browser-local validated draft and provide a safe file export or CLI handoff; the Worker will not write the tracked `.agent/skills.json` directly.
- Add `GET /api/project/context` to read the web-owned project context snapshot from D1 and calculate the active budget with deterministic partition rounding.
- Add `POST /api/memory/query` to validate a bounded query, create an embedding with the optional Workers AI binding, query Vectorize, and hydrate approved metadata from D1 without logging query contents or provider failures.
- Add the missing `@sibylhub/api-client` workspace package for typed, secret-safe calls to the web routes and optional Rust contract compatibility or ingestion. The cockpit read path remains D1-backed and does not require a live Rust backend. Add web dependencies on `@sibylhub/design-system` and `@sibylhub/schemas`.
- Add the minimum D1 schema and versioned route payload contracts needed by the cockpit. The web route remains renderable with deterministic local data when optional bindings are absent.
- Import the design-system token stylesheet through the Tailwind v4 CSS-first path. Keep the Worker preview command on `wrangler dev --local`; do not introduce Pages commands.
- Add focused route, contract, rendering, accessibility, and island interaction tests, with local checks that do not contact Cloudflare or require production credentials.

## Capabilities

### New Capabilities

- `web-cockpit`: Operator cockpit, context observatory, memory search, dependency audit, audited skill catalog, and the web-owned data contracts that support them.

### Modified Capabilities

None. The existing `web-application` requirements remain the platform baseline. The new cockpit will satisfy that baseline while adding feature-specific behavior.

## Impact

- Affected application: `apps/web`, including Astro configuration, Wrangler bindings, package scripts, styles, layouts, pages, API routes, runtime types, and tests.
- Affected workspace packages: `packages/api-client` will be created. `apps/web` will consume the existing `@sibylhub/design-system` and `@sibylhub/schemas` packages.
- Cloudflare contracts: D1 `DB`, R2 `AST_STORAGE`, and Vectorize `VECTORIZE_INDEX` remain named bindings. Workers AI `AI` will be optional for the memory route and will be absent from local baseline requirements.
- Data ownership: project context, dependency evidence, and memory metadata used by the cockpit will have an explicit web-owned D1 contract. The web will not connect directly to Laravel tables.
- Security and operations: no credentials, private keys, live resource identifiers, or raw provider failures will enter tracked files, URLs, logs, or client payloads. Remote deployment and any future authenticated skill synchronization remain separate operations.
