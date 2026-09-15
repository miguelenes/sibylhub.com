## 1. Runtime and shared contract foundation

- [ ] 1.1 Upgrade the repository Node baseline to the selected Node 22 LTS line in `.nvmrc`, root engine/configuration checks, and CI/runtime declarations, then verify `pnpm check:config` and existing workspace package checks pass under that runtime
- [ ] 1.2 Add the versioned candidate-ingestion types, Zod validators, JSON Schema artifacts, and canonical fixtures to `packages/schemas` without changing the existing schema-2.0 public catalog contract, then verify accepted and rejected candidate fixtures
- [ ] 1.3 Export candidate validators, types, schemas, and fixtures from the built `@sibylhub/schemas` package, then verify a packaged consumer resolves them without source-relative imports
- [ ] 1.4 Implement shared candidate identity, PURL, evidence, safety, and deterministic-order helpers, then verify scoped npm, namespaced Composer/Go, missing-metadata, unsafe-content, and repeated-serialization fixtures

## 2. Scraper package and command surface

- [ ] 2.1 Create the private `apps/scraper` workspace package with the selected Node engine and required scripts (`crawl:all`, `crawl:npm`, `crawl:packagist`, `crawl:pypi`, `crawl:crates`, and `crawl:libs-tech`), then verify pnpm workspace discovery and `pnpm check:config`
- [ ] 2.2 Add the scraper configuration boundary for source URLs, user-agent values, request limits, artifact paths, optional sync, and optional Firecrawl settings, then verify missing or unsafe configuration fails without logging secret values
- [ ] 2.3 Implement the registry adapter contract, source registry, candidate normalization pipeline, and per-source result model, then verify adapters can be substituted with deterministic fixtures
- [ ] 2.4 Implement the native fetch/undici client, per-source `p-queue` limits, timeout handling, bounded retry/backoff with jitter, `Retry-After` handling, and safe error classification, then verify 429, 5xx, timeout, permanent-error, and source-isolation tests
- [ ] 2.5 Implement the Commander `sibyl-scrape run` command, ecosystem aliases, limit/concurrency/firecrawl/sync flags, TTY progress behavior, non-TTY machine output, exit semantics, and framework statistics, then verify the documented example command and CI-style output

## 3. Registry adapters and discovery semantics

- [ ] 3.1 Implement the npm adapter with configured framework/category seed searches, pagination, deduplication, detail lookup, package metadata normalization, and npm PURL preservation, then verify fixtures for scoped packages, pagination, ranking basis, and missing fields
- [ ] 3.2 Implement the Packagist adapter with configured vendor/framework searches, pagination, package detail lookup, Composer PURL namespace/name handling, and source-ranked discovery reporting, then verify fixtures for vendor collisions and unavailable metadata
- [ ] 3.3 Implement the PyPI adapter with Simple API project discovery, versioned maintained seed coverage, JSON detail lookup, normalized release/license/repository metadata, and curated/seed ranking reporting, then verify fixtures for project-name normalization and absent ranking data
- [ ] 3.4 Implement the crates.io adapter with download-sorted pagination, required user-agent behavior, detail lookup, Cargo PURLs, and bounded API handling, then verify fixtures for download ranking, pagination, and rate-limit responses
- [ ] 3.5 Implement the Go adapter for configured module paths using Go Proxy and pkg.go.dev metadata, including escaped module identity and version handling, then verify fixtures for module paths, unavailable global ranking, and source conflicts
- [ ] 3.6 Register the five supported adapters, implement aggregate deduplication by canonical identity, and report NuGet and other unimplemented ecosystems as unsupported, then verify `crawl:all` preserves successful candidates while exposing unsupported and failed source statuses

## 4. Curated evidence, classifiers, and advisory choices

- [ ] 4.1 Implement the `libs.tech` extractor for categories, alternatives, comparisons, pros, cons, opinions, repositories, licenses, and stars using bounded HTML parsing and sanitized fixtures, then verify attributed observations and source-conflict reporting
- [ ] 4.2 Implement the optional Firecrawl provider with explicit enablement, host allowlisting, endpoint/credential validation, page/request/time budgets, timeout handling, and redacted failures, then verify disabled, rejected, successful-fixture, and provider-failure paths without SaaS calls
- [ ] 4.3 Implement versioned framework and category rules for the requested framework families and ORM, migration runner, HTTP framework, validation, testing, linter, builder, and state-management categories, then verify confidence, rationale, evidence references, unknown states, and multi-category detections
- [ ] 4.4 Implement evidence conflict normalization so registry facts, curated observations, and classifier evidence remain independently attributable, then verify conflicting repository/license/star observations do not silently overwrite one another
- [ ] 4.5 Implement the advisory opinionated-choice assessment from available downloads/trends, maintenance, adoption, and edge/isolate compatibility signals, then verify factor breakdowns, insufficient-data handling, bounded scores, and no mutation of administrator-owned decisions

## 5. Deterministic artifacts and optional synchronization client

- [ ] 5.1 Implement the candidate-ingestion artifact envelope, crawl manifest, source coverage, diagnostics, telemetry, classifier versions, and stable candidate identity, then verify the artifact validates against the shared contract
- [ ] 5.2 Implement deterministic artifact sorting, content identity, safe local path handling, size limits, and secret scanning/redaction, then verify byte-identical replay and rejection of credentials, keys, bearer tokens, and unbounded raw responses
- [ ] 5.3 Implement the opt-in Laravel synchronization client with environment-backed URL/token configuration, bounded batches, explicit snake_case transport mapping, crawl/candidate idempotency keys, and no R2 access, then verify disabled, configured, rejected, duplicate, and retryable responses
- [ ] 5.4 Persist synchronization reports alongside local artifacts with accepted, duplicate, rejected, retryable, and unsupported outcomes, then verify a partial API failure remains auditable and does not erase the valid local artifact

## 6. Laravel candidate staging boundary

- [ ] 6.1 Add migrations and typed models for ingestion batches, staged candidates, evidence/observations, outcomes, and revocable ingestion tokens while preserving SQLite-friendly local defaults, then verify migrations and scoped uniqueness on the local test database
- [ ] 6.2 Add the Laravel request boundary that maps the approved transport fields into the shared candidate contract, validates the published machine-readable candidate schema artifact without importing TypeScript source at runtime, enforces schema/version/PURL/provenance/safety/request-size/batch-count rules, and verifies PHP-side compatibility against the shared accepted and rejected fixtures
- [ ] 6.3 Add least-privilege bearer-token authentication with hashed token storage, revocation, rotation, and non-secret audit fields, then verify missing, invalid, revoked, and insufficient-scope tokens cannot mutate staging state
- [ ] 6.4 Implement `POST /api/v1/ingest/packages` with per-candidate transaction outcomes, crawl/candidate idempotency, duplicate handling, retryable persistence reporting, and independent readback, then verify mixed valid/invalid batches and replay behavior
- [ ] 6.5 Keep candidate staging out of normalized catalog export and R2 publication, then verify `registry:export-public` ignores unreviewed staged candidates and ordinary ingestion tests never resolve or mutate the R2 disk
- [ ] 6.6 Implement the explicit review/import service that resolves package managers, primary categories, stable catalog fields, compatibility relationships, conflicts, and administrator-owned opinion fields, then verify incomplete or conflicting candidates cannot enter the publishable normalized source

## 7. Documentation and integration verification

- [ ] 7.1 Document scraper commands, ecosystem coverage, ranking semantics, environment configuration, artifact layout, sync opt-in, Firecrawl controls, and unsupported registries without including credentials, then verify the documented command runs against fixtures
- [ ] 7.2 Run scraper package lint, typecheck, tests, coverage, formatting, and build checks, then verify the results separately from provider-dependent acceptance checks
- [ ] 7.3 Run shared-schema validation and packaged-consumer checks, then verify candidate fixtures and existing schema-2.0 catalog fixtures remain independently valid
- [ ] 7.4 Run backoffice configuration, route, migration, formatting, tests, and coverage checks, then verify the candidate API and readback evidence are separate from public-export and R2 evidence
- [ ] 7.5 Run the repository finish gates (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build`) after all implementation changes, then record any blocked external-provider, synchronization, database, or R2 gates without claiming local success as remote convergence
- [ ] 7.6 Execute an explicitly authorized end-to-end fixture run from crawler artifact through Laravel staging and readback, then verify deterministic artifact identity, idempotent outcomes, no implicit catalog promotion, and no implicit R2 mutation
