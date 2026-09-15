## Why

SibylHub has a normalized ecosystem catalog but no reproducible producer for current package metadata, framework relationships, or curated library evidence. A governed crawler is needed to discover candidates across supported registries, preserve source evidence, classify framework choices, and hand validated data to the backoffice without bypassing its deterministic export and publication boundaries.

## What Changes

- Add a private `apps/scraper` package named `@sibylhub/scraper` with explicit registry and curated-source crawl commands.
- Add bounded adapters for npm, Packagist, PyPI, crates.io, and Go module discovery, with an explicit unsupported-ecosystem report for registries not implemented in the first release.
- Add a `libs.tech` source adapter and an optional, host-allowlisted Firecrawl enrichment path for pages that require rendered or structured extraction.
- Define a shared candidate-ingestion contract covering stable PURLs, normalized package metadata, framework/category detections, source provenance, evidence, classifier rationale, telemetry, and crawl identity.
- Add deterministic local candidate-artifact output as the default handoff, with an authenticated, idempotent Laravel ingestion boundary for explicitly enabled synchronization.
- Keep candidate ingestion separate from the complete schema-2.0 catalog export: review, normalization, relationship resolution, and completeness validation remain backoffice responsibilities.
- Add rate limiting, retry/backoff handling for transient failures and HTTP 429 responses, per-source telemetry, bounded concurrency, safe structured logging, and non-TTY CLI behavior.
- Add framework/category heuristics and opinionated-choice scoring as explainable candidate metadata rather than silently overwriting administrator-owned catalog decisions.
- Add tests and package-level validation for adapter normalization, PURL preservation, pagination/deduplication, provenance, safety rules, artifact determinism, API idempotency, and failure reporting.

## Capabilities

### New Capabilities

- `package-ingestion`: Discover, normalize, classify, and emit package candidates and curated library evidence from supported registries and sources.

### Modified Capabilities

- `shared-schemas`: Add a versioned candidate-ingestion envelope and evidence contract that can be consumed by the scraper and Laravel boundary without changing the existing schema-2.0 public catalog shape.
- `backoffice-ecosystem-source`: Add an authenticated candidate-ingestion/import boundary that validates, deduplicates, audits, and stages candidates without making unreviewed crawler data the publishable catalog source.

## Impact

- New TypeScript package under `apps/scraper`, discovered by the existing pnpm workspace and root task graph.
- Shared TypeScript schema types, validators, fixtures, and package exports.
- Laravel routes, authentication/token configuration, request validation, candidate storage or staging models, import services, and readback tests in `apps/backoffice`.
- New environment-driven source and optional Firecrawl configuration; no credentials or live values are committed.
- Upgrade the repository Node baseline to Node 22 LTS as an implementation prerequisite because the requested scraper brief specifies Node 22+; the change must stop if the existing workspace gates regress under the new baseline.
- The first release does not claim complete discovery for all 25 catalog languages unless the remaining registry adapters and ranking sources are explicitly added.
- Ordinary local crawling writes local artifacts only; backoffice export and separately authorized R2 publication remain independent gates.
