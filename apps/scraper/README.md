# SibylHub package crawler

`@sibylhub/scraper` discovers bounded package candidates and writes a validated
candidate-ingestion artifact. It does not install packages, execute repository
code, write the normalized catalog, publish R2 objects, or synchronize with the
backoffice unless that boundary is explicitly enabled.

## Commands

Build before using the compiled commands:

```sh
pnpm --filter @sibylhub/scraper build
pnpm --filter @sibylhub/scraper crawl:npm
pnpm --filter @sibylhub/scraper crawl:packagist
pnpm --filter @sibylhub/scraper crawl:pypi
pnpm --filter @sibylhub/scraper crawl:crates
pnpm --filter @sibylhub/scraper crawl:libs-tech
pnpm --filter @sibylhub/scraper crawl:all
```

The command surface is also available as:

```sh
node apps/scraper/dist/cli.js run --ecosystems npm,python --limit 25 --concurrency 5 --json
```

Supported aliases are `javascript`/`typescript` → npm, `php` → Packagist,
`python` → PyPI, and `rust` → crates.io. Go modules are included by `all` and
can be selected with `--ecosystems go`. NuGet, Maven, RubyGems, Hex, Pub, and
other registries without adapters are reported as unsupported.

Ranking is source-specific: npm uses registry search order, Packagist uses
seed-ranked search results, PyPI uses maintained seeds, crates.io uses download
ordering, Go uses configured module seeds, and libs.tech is curated order. No
source-specific ordering is presented as a universal global ranking.

## Configuration

Configuration is environment-backed. Safe defaults use public registry URLs,
bounded limits, an artifact directory of `.artifacts/scraper`, and disabled
synchronization and Firecrawl enrichment.

Useful variables include `SCRAPER_LIMIT`, `SCRAPER_CONCURRENCY`,
`SCRAPER_TIMEOUT_MS`, `SCRAPER_MAX_ATTEMPTS`, `SCRAPER_MAX_PAGE_BYTES`,
`SCRAPER_MAX_ARTIFACT_BYTES`, `SCRAPER_MAX_BATCH_SIZE`,
`SCRAPER_ARTIFACT_DIR`, and `SCRAPER_USER_AGENT`. Source endpoints can be
overridden with the `SCRAPER_NPM_URL`, `SCRAPER_PACKAGIST_URL`,
`SCRAPER_PYPI_URL`, `SCRAPER_CRATES_URL`, `SCRAPER_GO_PROXY_URL`,
`SCRAPER_PKG_GO_DEV_URL`, and `SCRAPER_LIBS_TECH_URL` variables.

Enable Laravel synchronization only with `SCRAPER_SYNC_ENABLED=true`,
`SCRAPER_API_URL`, and `SCRAPER_API_TOKEN`. The token is never accepted as a
CLI argument and is not written to artifacts or logs. Requests use bounded
snake_case batches, crawl/candidate-derived idempotency keys, and produce a
`.sync.json` report beside the local artifact.

Enable Firecrawl only with `SCRAPER_FIRECRAWL_ENABLED=true`, an endpoint,
token, and a host allowlist. Page size, request count, and timeout budgets are
enforced; disabled, rejected, or unavailable enrichment does not block native
registry crawling.

## Artifacts and safety

Each successful supported crawl writes
`candidate-ingestion-<crawl-id>.json` below the configured artifact directory.
The artifact contains the versioned `candidate-ingestion/1.0` envelope, source
coverage, normalized candidates, bounded evidence, diagnostics, telemetry,
classifier versions, and a deterministic `sha256:` content identity. A
corresponding synchronization report records accepted, duplicate, rejected,
retryable, and unsupported outcomes when synchronization is enabled.

Credentials, private keys, bearer tokens, executable directives, and unbounded
provider responses are rejected before artifact publication. A partial source
failure remains visible in the artifact and summary; it only makes the command
non-zero when `--strict` is supplied, unless no valid artifact can be produced.
