## Context

See `proposal.md` for the motivation and scope. The repository currently has a schema-2.0 normalized catalog owned by Laravel, deterministic local export, and a separately authorized R2 publisher. The catalog is complete-catalog oriented: package records require resolved package-manager and category relationships, use `managed` PURL versions for catalog identities, and do not store the release-level observations needed by a crawler.

There is no `apps/scraper` package, no candidate-ingestion API, and no existing Firecrawl integration. The current workspace pins Node `20.19.0`, while the requested scraper runtime is Node 22+. The change therefore crosses the root runtime policy, a new TypeScript package, the shared schema package, and a new Laravel staging boundary. Existing web, Rust, and backoffice changes in the dirty worktree are unrelated and must remain untouched.

## Goals / Non-Goals

**Goals:**

- Produce reproducible, bounded package candidates from npm, Packagist, PyPI, crates.io, Go module sources, and `libs.tech`.
- Preserve canonical PURLs, release metadata, source provenance, evidence, classifier versions, diagnostics, and telemetry.
- Make ranking limitations, unsupported ecosystems, partial failures, and missing metadata visible.
- Provide deterministic local candidate artifacts as the primary handoff and an opt-in authenticated Laravel staging API.
- Keep crawler candidates separate from administrator-owned normalized catalog records and the schema-2.0 public export.
- Support explainable framework/category detections and advisory package-choice assessments without executing untrusted packages.
- Keep ordinary crawls offline from the backoffice, R2, and Firecrawl unless the operator explicitly enables each boundary.

**Non-Goals:**

- Complete discovery or publishable coverage of all 25 catalog languages in the first release. NuGet, Maven, RubyGems, Hex, Pub, and other unimplemented ecosystems remain explicitly unsupported until their adapters and ranking semantics are added.
- Treating every registry result as a globally ranked top-package list.
- Direct crawler writes to the normalized `packages` table, public catalog artifacts, or R2.
- Running package managers, installing discovered packages, importing arbitrary repository code, or evaluating untrusted build/configuration files.
- Making Firecrawl mandatory or sending every page through a paid enrichment service.
- Replacing administrator review with an automated `opinionated` catalog decision.

## Decisions

### 1. Keep discovery, staging, normalization, and publication as separate boundaries

The system will use the following flow:

```text
+-------------------+     +---------------------+     +----------------------+
| Registry adapters  | --> | Candidate normalizer | --> | Deterministic artifact |
| and libs.tech      |     | and classifiers      |     | validation and output  |
+-------------------+     +---------------------+     +----------+-----------+
                                                                    |
                                      +-----------------------------+------------------+
                                      |                                                |
                                      v                                                v
                         [optional authenticated API]                    [local review/import]
                                      |                                                |
                                      v                                                v
                           [Laravel candidate staging] --> [explicit resolution into normalized source]
                                                                                       |
                                                                                       v
                                                                       [registry:export-public]
                                                                                       |
                                                                                       v
                                                                          [authorized R2 publish]
```

The crawler owns discovery, normalization into the candidate contract, evidence, and artifact identity. Laravel owns candidate staging, review, relationship resolution, and promotion into the normalized source. The existing export and publication services remain the only path to the complete public catalog and R2.

This is preferred over direct crawler-to-catalog writes because the current catalog requires complete language relationships and stable administrator-owned choices. It also permits offline review and replay when a provider is unavailable.

### 2. Upgrade the workspace runtime baseline to Node 22 LTS

The explicit scraper requirement is Node 22+, so implementation will update the repository’s Node baseline, including `.nvmrc`, the root engine/check-config policy, and any CI/runtime declarations that currently require `20.19.0`. The scraper package will declare a Node 22+ engine range compatible with the selected repository baseline.

The upgrade is a prerequisite, not a scraper-local override. Existing workspace packages must pass their focused checks and the root gates after the change. If the baseline upgrade cannot be validated across the workspace, scraper implementation stops before deployment rather than maintaining two unsupported Node policies.

The scraper will consume the currently supported Zod major exported by `@sibylhub/schemas` rather than adding a parallel Zod 3 dependency graph. The repository currently uses Zod 4; a requirement to preserve Zod 3 compatibility would need a separately approved shared-schema migration.

### 3. Use a stable adapter contract with explicit discovery semantics

The TypeScript package will expose a registry adapter contract with the requested responsibilities:

```text
ecosystem
fetchTopPackages(limit, discoveryOptions)
fetchPackageDetails(packageSummary)
detectFrameworks(packageDetails)
```

The public behavior of `fetchTopPackages` is “bounded package discovery,” not an implied universal ranking. Each adapter returns a discovery record containing source, query or module seed, pagination position, rank basis, and whether the result is global, source-ranked, seed-ranked, or curated.

The first release will use these source strategies:

| Source | Discovery strategy | Ranking claim |
| --- | --- | --- |
| npm | Official search API with configured framework/category keyword seeds, pagination, deduplication, and detail lookup | Search-ranked within each seed; not global unless the endpoint explicitly provides that semantics |
| Packagist | Packagist search/list endpoints with configured vendors and framework seeds, pagination, and package detail metadata | Seed/vendor-ranked; no universal global popularity claim |
| PyPI | Simple API for project-name discovery plus a versioned maintained seed list for framework/category coverage; JSON detail lookup | Curated/seed-ranked unless an explicitly configured ranking source is added |
| crates.io | Official API pages sorted by downloads with required user-agent and bounded pagination | Registry download-ranked for the requested sort and time of crawl |
| Go | Configured module paths queried through Go Proxy and metadata pages from pkg.go.dev | Module-seed-ranked; Go Proxy has no global top-package endpoint |
| libs.tech | Curated category, alternative, comparison, and package pages | Curated-source order; never represented as objective global rank |

Go is a supported first-release adapter selected through `--ecosystems go` and included by `crawl:all`; the fixed script surface does not add a separate `crawl:go` command because the requested scripts are limited to the five registry-specific commands and `crawl:libs-tech`.

The configured seeds and ranking basis are versioned in source, included in the crawl manifest, and emitted in the artifact. A future ranking provider can be added without changing the candidate identity contract.

### 4. Normalize candidates around PURLs and observations, not catalog rows

Each candidate receives a stable identity derived from its canonical PURL and source ecosystem. PURL type, namespace, name, version, qualifiers, and subpath remain separate fields. `@sindresorhus/slugify` may produce human-friendly slugs for filenames or display, but it is never used to replace a scoped or namespaced PURL component.

The candidate contract contains, where available:

- canonical PURL and registry/ecosystem identity;
- package name, namespace, release version, homepage, repository, license, description, and keywords;
- download observations with value, period, source, sampled time, and optional prior sample;
- star observations with value, source, sampled time, and repository identity;
- framework and category detections with confidence, classifier version, rationale, and evidence references;
- advisory choice assessment with factor values, score, summary, and review status;
- source observations and conflicts, including curated versus registry origin;
- resolution state for optional `packageManagerId`, `categoryId`, and other catalog relationships.

Download acceleration is calculated only when comparable samples from the same source and period are present. Missing or incomparable samples are represented as unknown. A candidate may carry multiple category detections even though the current catalog eventually requires a primary package category.

The shared artifact uses a distinct candidate schema identity such as `candidate-ingestion/1.0`; it is not schema `2.0` and is not stored as a language artifact. The Laravel API transport may use the requested snake_case fields (`package_manager_id`, `package_category_id`, `is_opinionated_choice`, and `opinion_summary`) at its request boundary, but it maps once into the canonical shared representation and rejects unknown aliases. This makes the compatibility boundary explicit rather than maintaining two competing domain contracts.

### 5. Treat evidence as first-class, bounded, and source-attributed

Every material observation includes a canonical source URL, source kind, retrieval timestamp, content hash, and a bounded locator or excerpt when needed for review. Registry facts, curated opinions, comparison claims, and classifier evidence are different evidence kinds and remain attributable to their origin.

The normal crawl stores normalized metadata and bounded evidence, not unlimited HTML or raw provider payloads. If a raw response is retained for debugging, it is written to a local non-publishable diagnostic location subject to size limits and secret scanning; it is not included in the candidate artifact by default.

The `libs.tech` extractor uses source-specific selectors and fixture tests for category, alternative, comparison, pros, cons, opinions, repository, license, and star fields. A source conflict becomes an observation conflict for review. It does not overwrite a registry value merely because it was scraped later.

Firecrawl is an optional provider behind an explicit `--firecrawl` or equivalent configuration gate. It requires an environment-provided endpoint and credential, an allowlist of hosts, bounded page size and request count, and a timeout/cost budget. Credentials are supplied through the runtime environment or approved secret store, never command arguments, URLs, artifacts, or logs. A disabled or unavailable Firecrawl provider degrades enrichment only; it does not block registry-only crawling.

### 6. Use deterministic concurrency, retries, and telemetry

Native Node `fetch`/`undici` is used for HTTP, `cheerio` for bounded HTML parsing, and `p-queue` for per-source concurrency and interval limits. Each source has an independent queue so a slow or throttled provider cannot consume the entire crawl budget.

Retry policy:

- retry network failures and HTTP 408, 429, 500, 502, 503, and 504;
- honor `Retry-After` only within a configured maximum delay;
- use capped exponential backoff with jitter and a finite attempt budget;
- do not retry 400, 401, 403, 404, unsupported responses, or schema-invalid payloads;
- classify timeout, throttling, authentication, provider, parse, validation, and permanent-not-found failures separately.

Telemetry is emitted as structured, secret-redacted data with crawl ID, source, request class, page/seed, attempts, status, duration, and counts. It records total discovered, deduplicated, detailed, normalized, classified, conflicted, synchronized, skipped, and failed candidates. Raw URLs are normalized and redacted where query parameters could contain credentials.

### 7. Make classification explainable and non-executable

Framework detection uses package names, registry keywords, declared dependency metadata, repository metadata, curated labels, and allowlisted documentation evidence. It does not install packages, execute repository code, run package scripts, or trust arbitrary configuration as executable input.

The first classifier catalog covers the requested framework families, including React, Vue, Angular, Svelte, Hono, Express, Laravel, Symfony, WordPress, FastAPI, Django, Flask, Axum, Tokio, Actix, SQLx, and Serde, and the requested categories: ORM, migration runner, HTTP framework, validation, testing, linter, builder, and state management. Each rule has a version, positive evidence requirements, confidence threshold, and test fixture.

The advisory choice assessment is deliberately separate from detection. It may consider downloads and trends, maintenance/release cadence, repository activity, ecosystem adoption, and edge/isolate compatibility evidence. Each factor is optional and weighted only when its source and comparability are valid. The output is advisory, records insufficient-data cases, and cannot mutate the backoffice `opinionated` flag without review.

### 8. Make artifacts and synchronization explicit

The package writes a local artifact by default under a crawl-scoped path selected by configuration. The artifact includes a crawl manifest, candidate list, evidence, diagnostics, coverage status, classifier versions, and content identity. Canonical sorting is by stable candidate identity, then source observation identity, with deterministic object-key serialization.

Remote synchronization is opt-in and uses an API URL and token supplied through environment-backed configuration. Tokens are never accepted as CLI arguments. The client sends bounded batches with a crawl ID and idempotency key and records the Laravel response as a local synchronization report. It does not know or access R2 credentials.

The Laravel endpoint is a dedicated candidate staging boundary. A hashed, revocable ingestion-token record with a least-privilege scope authenticates the request. The endpoint validates the candidate contract, limits request size and item count, persists accepted candidates and evidence in staging tables, and returns per-candidate accepted, duplicate, rejected, or retryable outcomes. Envelope-invalid requests are rejected before persistence; valid envelopes may commit independent valid candidates while recording invalid candidates as rejected. Replays are keyed by crawl and candidate identity and cannot create duplicate staging rows.

Laravel validates the same versioned machine-readable candidate schema artifact published through `@sibylhub/schemas` (or an equivalent generated PHP-consumable artifact); it does not import TypeScript source files at runtime. Shared accepted and rejected fixtures are used to verify parity between the scraper validators and the Laravel request boundary.

Candidate staging never writes the publishable `packages` table or R2. An explicit review/import service resolves the package manager, primary category, stable catalog fields, compatibility relationships, and administrator-owned opinion before the ordinary schema-2.0 export path can observe the record.

### 9. Define CLI and package boundaries

`apps/scraper/package.json` will remain private and expose the requested scripts. The scripts call one compiled command surface so flags, logging, validation, and exit semantics do not diverge between registry-specific and aggregate runs.

The command supports:

- `--ecosystems` for configured language/ecosystem aliases;
- `--limit` as a total per selected source unless the summary states otherwise;
- `--concurrency` as a bounded per-source limit;
- `--firecrawl` only when provider configuration passes validation;
- `--sync` only when API configuration is present;
- a machine-readable output mode for CI and a progress/statistics mode for TTY sessions.

Interactive progress is disabled for non-TTY or CI output. The final summary always contains stable counts and source statuses. A valid artifact with partial source failures is distinguishable from a fully successful run; strict mode can make partial failures non-zero without discarding the valid artifact.

### 10. Validate locally without provider dependency

Registry tests use deterministic HTTP fixtures or a local test server for pagination, 429 handling, retry-after behavior, malformed metadata, namespace preservation, deduplication, and source conflicts. `libs.tech` tests use captured sanitized fixtures. Firecrawl tests cover disabled, allowlisted, rejected, timeout, and redacted-failure paths without calling the SaaS provider.

Shared schema tests validate candidate fixtures from the packaged distribution. Laravel tests validate token scope, batch limits, idempotent staging, per-candidate outcomes, readback, and the invariant that candidate ingestion does not touch public export or R2. An explicitly authorized live-provider acceptance run, if later needed, is recorded separately from local gates.

The implementation finish gates remain repository-specific: configuration checks, lint, typecheck, tests, coverage, formatting, and build. Package-focused checks do not replace the root gates, and local success does not prove external provider authentication, database convergence, or R2 publication.

## Risks / Trade-offs

- [Risk] Registry APIs change ranking, pagination, or response fields. -> [Mitigation] Keep source-specific adapters and fixtures, record provider/ranking semantics, validate response shapes, and fail a source visibly rather than guessing.
- [Risk] Seeded discovery may be mistaken for global popularity. -> [Mitigation] Put ranking basis and seed in every candidate and report unsupported global-ranking claims explicitly.
- [Risk] Curated opinions and registry facts conflict. -> [Mitigation] Preserve attributed observations and require review for material conflicts.
- [Risk] A provider throttles or blocks the crawler. -> [Mitigation] Apply per-source queues, bounded retries, `Retry-After` handling, user-agent policy, and a resumable local artifact.
- [Risk] Scoped or namespaced package identity is lost through slugging. -> [Mitigation] Make PURL components canonical, keep namespace separate, and test scoped/npm and namespaced/composer/go fixtures.
- [Risk] Candidate metadata becomes an unreviewed second catalog. -> [Mitigation] Store it in a separate contract and staging boundary; keep normalized promotion and public export explicit.
- [Risk] API tokens or provider credentials leak through logs or artifacts. -> [Mitigation] Use environment/secret-store injection, hashed Laravel token storage, redaction tests, no token CLI flags, and secret scanning before artifact write.
- [Risk] Node 22 migration affects unrelated workspace packages. -> [Mitigation] Treat the runtime bump as a prerequisite, run the complete local gates, and retain staged candidate data so the crawler can be disabled or rolled back independently.
- [Risk] New HTTP/HTML dependencies increase the lockfile or supply-chain surface. -> [Mitigation] Reuse existing workspace versions where compatible, pin through pnpm, review licenses/advisories, and avoid adding a second schema-validation stack.

## Migration Plan

1. Update the OpenSpec-backed shared candidate contract and fixtures without changing the existing schema-2.0 public catalog contract.
2. Upgrade and validate the repository Node baseline to Node 22 LTS, including root configuration and CI declarations. Stop if existing workspace gates regress.
3. Add `apps/scraper` with the shared types/validators, deterministic artifact writer, CLI surface, source queues, and fixture-driven adapter tests.
4. Add the five registry adapters, `libs.tech` evidence extraction, classifier catalog, telemetry, and optional Firecrawl provider. Confirm unsupported ecosystems are visible in aggregate summaries.
5. Add Laravel candidate staging migration/models/services, dedicated ingestion-token boundary, route, validation, idempotency, and readback tests. Keep the route disabled or non-publishing in local defaults.
6. Add explicit review/import resolution into normalized records only after staging and conflict diagnostics are verified. Do not alter `registry:export-public` behavior until the normalized promotion path is complete.
7. Run package-focused checks, then the documented root and backoffice gates. Record live-provider, API, and R2 evidence separately if authorized.
8. Enable synchronization only after local artifact validation and Laravel readback pass. Use token rotation and route disablement as rollback controls.

Rollback is staged: disable `--sync` and revoke ingestion tokens, keep local candidate artifacts for replay, leave staged rows intact for audit unless a separately authorized retention cleanup is requested, and revert only the promotion/API code if needed. The existing normalized catalog and revision-scoped R2 publication remain unchanged and continue to provide the last known-good public state.
