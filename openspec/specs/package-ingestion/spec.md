# package-ingestion Specification

## Purpose

Provide a bounded, evidence-preserving package discovery capability that turns registry and curated-source observations into validated candidates without silently promoting external metadata into the governed public catalog.

## Requirements

### Requirement: Package discovery is explicit, bounded, and honest about ranking

The crawler SHALL provide `crawl:all`, `crawl:npm`, `crawl:packagist`, `crawl:pypi`, `crawl:crates`, and `crawl:libs-tech` package scripts and SHALL expose a `sibyl-scrape run` command with ecosystem selection, package limit, and concurrency controls. Each registry adapter SHALL report whether a result is globally ranked, source-ranked, seed-ranked, or curated; the crawler SHALL not describe seeded discovery as a universal popularity ranking. Unsupported ecosystems SHALL be reported explicitly with an `unsupported` status.

#### Scenario: A supported ecosystem is selected

- **WHEN** an operator runs `sibyl-scrape run --ecosystems typescript,python,rust --limit 500 --concurrency 5`
- **THEN** the crawler maps the selections to configured registry sources, applies the requested bounds, and emits a run summary with discovered, normalized, classified, failed, and skipped counts

#### Scenario: A source has no global ranking endpoint

- **WHEN** an adapter discovers packages through configured framework seeds or known module paths
- **THEN** each candidate records the seed and ranking semantics, and the run output does not claim that the result is a global top-package list

#### Scenario: An unsupported registry is requested

- **WHEN** an operator requests an ecosystem without an implemented adapter
- **THEN** the run summary records the ecosystem as unsupported, explains the missing adapter, and does not fabricate package results

### Requirement: Registry adapters preserve canonical package identity and normalized metadata

The crawler SHALL normalize each accepted candidate into a stable PURL-bearing record that preserves registry type, namespace, canonical name, available release version, homepage, repository, license, description, keywords, download observations, star observations, and source provenance. Scoped and namespaced package identities SHALL retain their namespace and name as separate canonical components; slug fields SHALL NOT replace or rewrite PURL identity.

#### Scenario: A scoped package is discovered

- **WHEN** a registry returns a package such as `@types/react`
- **THEN** the candidate preserves the npm namespace and package name in its PURL and normalized identity, and any derived slug is treated only as a display or lookup field

#### Scenario: A registry omits optional metadata

- **WHEN** a package detail response lacks stars, license, downloads, or repository data
- **THEN** the candidate leaves the unavailable field absent or explicitly unknown, records the source response, and does not invent a value

#### Scenario: A malformed package identity is returned

- **WHEN** a response cannot produce a valid supported PURL
- **THEN** the candidate is rejected with a field-level diagnostic and the invalid identity is not emitted in a candidate artifact or synchronization request

### Requirement: Adapter execution is rate-limited, retryable, and failure-isolated

The crawler SHALL apply independent concurrency and request-rate limits per external source, SHALL honor bounded `Retry-After` values, SHALL retry transient transport failures and HTTP 429/5xx responses with capped exponential backoff and jitter, and SHALL avoid retrying permanent authentication, authorization, malformed-request, or not-found failures. A failure for one package or source SHALL be recorded and SHALL NOT discard successfully normalized candidates from other sources.

#### Scenario: A source returns HTTP 429

- **WHEN** a registry responds with HTTP 429 and an optional `Retry-After` value
- **THEN** the adapter waits within the configured cap, retries according to the source budget, and records the final attempt count and outcome without logging credentials

#### Scenario: A package detail request returns not found

- **WHEN** a previously discovered package no longer has a detail response
- **THEN** the crawler records a skipped or failed detail outcome for that package and continues processing independent candidates

#### Scenario: An adapter exceeds its retry budget

- **WHEN** all bounded attempts for a source request fail
- **THEN** the crawler emits a structured failure with source, endpoint class, package identity when known, and safe error classification, while preserving completed results

### Requirement: Framework and category detections are explainable

The crawler SHALL classify candidates into the configured package categories, including ORM, migration runner, HTTP framework, validation, testing, linter, builder, and state management, and SHALL detect React, Vue, Angular, Svelte, Hono, Express, Laravel, Symfony, WordPress, FastAPI, Django, Flask, Axum, Tokio, Actix, SQLx, and Serde. Every detection SHALL include a confidence level, evidence references, classifier version, and rationale. Missing evidence SHALL produce an unknown result rather than a confident negative or positive inference.

#### Scenario: A package matches multiple categories

- **WHEN** package metadata and curated evidence identify both an HTTP framework and a testing integration
- **THEN** the candidate contains separate category detections with independent confidence and evidence rather than collapsing them into one category

#### Scenario: A classifier rule changes

- **WHEN** the crawler runs after a classifier version is updated
- **THEN** the candidate records the classifier version so prior results remain explainable and comparable

#### Scenario: A package has insufficient evidence

- **WHEN** no configured rule has enough evidence to classify a package
- **THEN** the candidate contains no unsupported classification and identifies the missing-evidence condition in telemetry or diagnostics

### Requirement: Curated library evidence is kept distinct from registry facts

The `libs.tech` source SHALL capture categories, alternatives, comparisons, pros, cons, opinions, repository links, licenses, and stars when present as attributed observations with source URLs and retrieval timestamps. Optional Firecrawl enrichment SHALL require explicit enablement, configured credentials, host allowlisting, request and cost bounds, and redacted failure reporting. Curated opinions SHALL not overwrite registry metadata or administrator-owned catalog decisions.

#### Scenario: A curated comparison conflicts with registry metadata

- **WHEN** `libs.tech` reports a repository or license that differs from a registry response
- **THEN** both observations remain attributed to their sources and the crawler reports the conflict for review rather than silently selecting one

#### Scenario: Firecrawl is not enabled

- **WHEN** a crawl runs without the explicit Firecrawl option and configuration
- **THEN** ordinary registry crawling completes without contacting Firecrawl, and pages requiring enrichment are reported as skipped or unenriched

#### Scenario: Firecrawl configuration is incomplete

- **WHEN** Firecrawl is requested without a valid endpoint, credential, or allowed host
- **THEN** the enrichment request fails closed before network use and the credential value is not included in logs, artifacts, or command output

### Requirement: Candidate artifacts are versioned, deterministic, and safe to hand off

The crawler SHALL emit a versioned candidate-ingestion artifact containing crawl identity, source coverage, normalized candidates, curated evidence, diagnostics, and telemetry. Artifact ordering, identity fields, and serialized bytes SHALL be deterministic for identical inputs and classifier versions. Candidate artifacts SHALL remain distinct from the schema-2.0 complete public catalog and SHALL not contain credentials, private keys, bearer tokens, or unbounded raw provider responses.

#### Scenario: The same crawl inputs are replayed

- **WHEN** the same source fixtures, configuration, and classifier versions are processed twice
- **THEN** the candidate artifacts have identical content, ordering, and content identity

#### Scenario: A candidate artifact contains unsafe content

- **WHEN** source data includes a detected credential, private key, or bearer token
- **THEN** validation rejects or redacts the affected evidence and the unsafe value is absent from the artifact and telemetry

#### Scenario: A candidate artifact is submitted to the backoffice

- **WHEN** a valid artifact is handed to the Laravel import boundary
- **THEN** the backoffice can validate its declared candidate schema version and crawl identity without treating the artifact as a complete publishable catalog

### Requirement: Opinionated-choice output is advisory and evidence-based

The crawler SHALL calculate an explainable advisory choice assessment from available download trends, maintenance signals, ecosystem adoption, and edge or isolate compatibility evidence. The assessment SHALL preserve factor values and source references, SHALL identify insufficient-data cases, and SHALL never overwrite the backoffice package `opinionated` flag or rationale without an explicit review/import decision.

#### Scenario: A candidate has sufficient evidence

- **WHEN** a package has supported download, maintenance, and compatibility observations
- **THEN** the candidate contains a bounded advisory score, factor breakdown, summary, and review status

#### Scenario: A candidate lacks maintenance evidence

- **WHEN** release cadence or maintenance data is unavailable
- **THEN** the assessment reports insufficient evidence and does not treat the missing signal as a positive score

### Requirement: CLI output is useful interactively and in automation

The crawler SHALL show bounded progress and framework statistics in an interactive TTY, SHALL avoid control sequences in non-TTY or CI output, SHALL provide machine-readable run summaries, and SHALL exit non-zero when a requested supported crawl cannot produce a valid artifact. Partial source failures SHALL remain visible in the summary even when the overall artifact is valid, and SHALL cause a non-zero exit only when strict mode is enabled.

#### Scenario: The crawler runs in CI

- **WHEN** the command runs with a non-TTY stdout or CI environment
- **THEN** it emits stable structured output without interactive progress control sequences and returns a status suitable for automation

#### Scenario: A crawl completes with partial failures

- **WHEN** some package details fail but a valid artifact is produced
- **THEN** the summary includes the failures and partial status, and the command exits successfully by default or non-zero in strict mode without hiding them

### Requirement: Remote synchronization is opt-in and idempotent

The crawler SHALL write a local validated artifact by default and SHALL require an explicit synchronization option for the Laravel boundary. Synchronization requests SHALL use the versioned candidate contract, bounded batch sizes, an idempotency identity derived from crawl and candidate identity, and a response that distinguishes accepted, rejected, duplicate, and retryable candidates.

#### Scenario: A crawl runs without synchronization enabled

- **WHEN** an operator runs any crawl script without the sync option
- **THEN** no backoffice endpoint, production database, or R2 publication target is contacted

#### Scenario: A synchronization request is replayed

- **WHEN** the same valid candidate batch is submitted again with the same crawl identity
- **THEN** the backoffice returns the prior outcome or duplicate status without creating duplicate staged candidates
