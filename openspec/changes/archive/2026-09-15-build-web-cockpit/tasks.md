## 1. Workspace contracts and deterministic calculations

- [x] 1.1 Create `packages/api-client` with its workspace manifest, ESM entrypoint, declarations, and package-owned tests; verify pnpm resolves the package without copying another runtime's lockfile.
- [x] 1.2 Define versioned project-context, dependency-audit, memory-query, and skill-draft DTOs plus safe error envelopes in `packages/api-client`; verify malformed payloads and unsupported versions are rejected by unit tests.
- [x] 1.3 Add typed request helpers for the web routes and optional, explicitly invoked Rust invariant/context APIs used by ingestion or contract compatibility; verify helpers never accept credentials, private keys, raw provider errors, or unbounded result limits in their public contract.
- [x] 1.4 Implement the pure five-partition budget allocator and quota-state mapping with the established weights and largest-remainder rounding; verify golden cases match the Rust context-budget contract and every allocation totals the requested ceiling.

## 2. Web runtime and storage foundations

- [x] 2.1 Replace `apps/web/astro.config.ts` with the requested `apps/web/astro.config.mjs`, preserving the Cloudflare adapter, React integration, Tailwind Vite plugin, and local port while enabling hybrid server/static behavior; verify `pnpm --filter web build` reads the new configuration.
- [x] 2.2 Add `@sibylhub/design-system`, `@sibylhub/schemas`, and `@sibylhub/api-client` to the web workspace manifest and update the pnpm lockfile through the repository package-manager workflow; verify dependency resolution and package type declarations succeed.
- [x] 2.3 Extend `apps/web/wrangler.toml` with the optional Workers AI `AI` binding while preserving named `DB`, `AST_STORAGE`, and `VECTORIZE_INDEX` bindings, local placeholders, absent production resource identifiers, and the `wrangler dev --local` preview path; verify `pnpm --filter web validate` rejects unsafe identifiers and contains no Pages command.
- [x] 2.4 Update web runtime declarations and binding doubles for the optional AI binding, D1 rows, Vectorize matches, and safe local responses; verify absent semantic bindings produce the unavailable memory state while an explicit test double covers a successful empty result without requiring Cloudflare resources.
- [x] 2.5 Add an additive web-owned D1 migration for project context snapshots, dependency evidence, and memory metadata with indexes and bounded-query fields; verify the migration applies to a local database and leaves empty tables safe for the baseline route.
- [x] 2.6 Add deterministic local fixtures for one project context snapshot, five partition values, dependency evidence, and separate explicit empty-result and unavailable memory sources; verify the default absent-binding path is unavailable, fixture validation uses existing shared schema rules, and fixtures contain no credentials or live identifiers.

## 3. Server data services and edge routes

- [x] 3.1 Implement the shared project-context service with parameterized D1 reads, local fallback selection, row validation, source-revision reporting, precomputed dependency evidence, and the shared budget allocator; verify the read path does not require a Rust backend and covers D1 success, missing D1, unknown project, malformed selection, invalid rows, and unavailable-source cases against the specified status codes.
- [x] 3.2 Add `GET /api/project/context` and its versioned JSON response using the shared service; verify the response contains all five partitions, exact integer totals, quota thresholds, RTK default handling, dependency evidence, and safe error envelopes.
- [x] 3.3 Implement bounded memory retrieval validation before provider calls, including query normalization, the 256-character limit, the ten-result limit, unknown-field rejection, and secret or executable-content rejection; verify invalid requests make zero AI, Vectorize, or D1 calls.
- [x] 3.4 Implement the configured memory path using one Workers AI embedding call for `@cf/baai/bge-small-en-v1.5`, one bounded Vectorize query, and bounded D1 metadata hydration; verify ranked matches contain only approved metadata, similarity scores, and read-only access counters.
- [x] 3.5 Add `POST /api/memory/query` unavailable, empty, and upstream-failure handling with private or no-store response semantics; verify the route returns stable `MEMORY_SEARCH_UNAVAILABLE` errors without logging or returning query content, credentials, or provider details.
- [x] 3.6 Add a versioned catalog loader that validates the available declarative skill source and fails closed when no first-party audited Rosie/FastMCP source exists; verify non-audited or non-declarative entries cannot become eligible through the server data boundary.

## 4. Server-rendered cockpit shell

- [x] 4.1 Import `@sibylhub/design-system/tokens` through the Tailwind v4 CSS-first stylesheet path and remove conflicting local token definitions while retaining HeroUI v3 styles and reduced-motion behavior; verify the generated CSS exposes semantic tokens and no legacy Tailwind config is introduced.
- [x] 4.2 Build `CockpitLayout.astro` with server-rendered project identity, navigation, project switcher, collapsible responsive navigation treatment, status labels, and semantic layout regions; verify the rendered HTML contains usable shell content without JavaScript.
- [x] 4.3 Update the cockpit page loader and primary route to obtain one bounded initial context snapshot, pass only serializable display-safe props to the islands, and render explicit local, unavailable, and stale states; verify the baseline page builds without live bindings or a live backend.
- [x] 4.4 Add the responsive visual structure for the observatory grid, dense telemetry cards, context partition treatment, memory region, dependency audit region, and skill catalog region using shared semantic utilities; verify no horizontal overflow at a 320 CSS pixel viewport.

## 5. React interaction islands

- [x] 5.1 Implement `ContextObservatory.tsx` as a `client:visible` island using the shared gauge and telemetry primitives, showing five partition percentages, token totals, quota state, active usage, and RTK savings from initial props; verify hydration preserves the SSR values and all threshold states have readable labels.
- [x] 5.2 Implement `MemoryGraphViewer.tsx` as a `client:visible` island with explicit query, loading, matches, no-matches, and unavailable states; verify successful results render descending similarity, bounded previews, categories, and access counters without changing the server-first prompt during hydration.
- [x] 5.3 Implement `DependencyAuditView.tsx` as a `client:visible` island that renders compliant, warning, violation, unconfigured, and unavailable evidence states; verify violations include severity, reason, invariant, and approved replacement when present, and missing evidence never becomes compliant.
- [x] 5.4 Implement `FastMcpSkillCatalog.tsx` as a `client:visible` island with audited/declarative eligibility, local draft toggles, changed-state feedback, deterministic `SkillsDocument` validation, and browser export or explicit CLI handoff; verify the Worker is never called to mutate `.agent/skills.json`.
- [x] 5.5 Add keyboard names, focus treatment, non-color state text, `aria-pressed` or equivalent toggle state, and reduced-motion handling across the shell and islands; verify keyboard interaction and reduced-motion tests cover project selection, navigation collapse, memory query, skill toggle, and export.

## 6. Verification and handoff gates

- [x] 6.1 Add focused route, contract, budget, fixture, SSR, island, accessibility, and security-redaction tests for the new package and web app; verify failure cases assert stable status codes and error codes rather than only snapshots.
- [x] 6.2 Run the documented web checks `pnpm --filter web validate`, `pnpm --filter web lint`, `pnpm --filter web typecheck`, `pnpm --filter web test`, `pnpm --filter web test:cov`, `pnpm --filter web format`, and `pnpm --filter web build`; record each result separately and resolve failures without weakening production validation.
- [x] 6.3 Run the local Worker preview with `pnpm --filter web preview` and smoke-test the baseline route plus context and memory unavailable states; verify preview uses `wrangler dev --local`, remains usable without live Cloudflare resources, and makes no remote calls.
- [x] 6.4 Confirm the guarded deployment script still requires an explicit preview or production target and that no task performs remote D1 migration, resource creation, registry publication, or deployment; verify the final change report separates local evidence from any unrun remote gates.
