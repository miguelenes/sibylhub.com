# backoffice-ecosystem-source Specification

## Purpose

Provide the Laravel and Filament 5 backoffice as the governed ecosystem source of truth, with validated registry data, deterministic public exports, and safe local administration boundaries.

## Requirements

### Requirement: The backoffice boots with the supported Laravel contract

The backoffice SHALL be a self-contained Laravel application using the supported PHP and Composer contract, SHALL document local startup and test setup, and SHALL boot from non-secret local configuration without requiring production services.

#### Scenario: A fresh local backoffice is started

- **WHEN** an engineer follows the documented setup with supported PHP, Composer, and local environment values
- **THEN** Laravel starts or reports an actionable prerequisite/configuration error without attempting a production connection

### Requirement: The backoffice provides a Filament 5 administration boundary

The backoffice SHALL expose a configured Filament 5 panel route, SHALL keep panel configuration and registry administration inside the backoffice application boundary, and SHALL return either the panel shell or an explicit authentication/authorization response rather than a missing-route or bootstrap error. The panel SHALL make the normalized ecosystem resources discoverable to authorized administrators.

#### Scenario: The panel route is requested locally

- **WHEN** the configured panel route is requested while the local application is running
- **THEN** the response is a Filament panel shell or an explicit authentication/authorization response with no framework bootstrap failure

#### Scenario: An authorized administrator opens the resource navigation

- **WHEN** an authenticated administrator loads the panel navigation
- **THEN** programming languages, package managers, packages, and stack invariants are discoverable as administration resources

### Requirement: The registry stores complete ecosystem source data

The backoffice SHALL maintain normalized, stable records for the 25 target programming languages and their runtimes, package registries, package managers, lockfile specifications, workspace configurations, package categories, packages, runtime compatibility relationships, builders, builder-language relationships, stack invariants, and documentation references and chunks. It SHALL reject publication of incomplete or unresolved relationships, SHALL derive a deterministic snapshot identity from the supported schema version and canonical source data, and public export SHALL use these normalized records rather than silently substituting a fixture or unrelated package-local fallback. Legacy generic registry revisions MAY be read only by an explicit migration/import path and SHALL NOT remain a second mutable export source.

#### Scenario: A complete normalized catalog is submitted

- **WHEN** an administrator submits all required language identities, related records, and resolvable relationships
- **THEN** the backoffice accepts the source data as eligible for a deterministic publishable snapshot

#### Scenario: A registry revision is submitted

- **WHEN** an administrator supplies a legacy registry revision to the explicit normalized import path with all required relationships and valid shared-schema identifiers
- **THEN** the importer maps it into normalized records with a stable snapshot identity, and the legacy row is not used as the canonical export source

#### Scenario: A normalized catalog is incomplete

- **WHEN** a required language, compatibility relationship, or referenced record is missing
- **THEN** the backoffice rejects the source data with actionable validation errors and does not mark it publishable

#### Scenario: A registry revision is incomplete

- **WHEN** a legacy registry revision supplied to the explicit normalized import path omits a required compatibility relationship or references an unknown schema identifier
- **THEN** the importer rejects the legacy input with actionable validation errors and does not create a publishable normalized snapshot

#### Scenario: A source record contains unsafe content

- **WHEN** a source field contains credentials, private keys, or unsupported executable directives
- **THEN** validation fails and the value is not emitted in a public snapshot

#### Scenario: No normalized source data is available

- **WHEN** an export is requested without valid normalized source data
- **THEN** the command exits non-zero with an actionable diagnostic and does not present fixture data as a publishable registry

#### Scenario: No validated registry revision is available

- **WHEN** an export is requested without a validated normalized source snapshot
- **THEN** the command exits non-zero with an actionable diagnostic and does not consult a legacy revision row or fixture as a publishable registry revision

### Requirement: Public registry export is deterministic and schema-conformant

The backoffice SHALL provide `php artisan registry:export-public`, SHALL generate a schema `2.0` public artifact set containing `data/v1/index.json` and one `data/v1/languages/{slug}.json` file for each target language, SHALL include the schema version and deterministic snapshot identity, and SHALL validate all cross-file references against the shared contract. The legacy schema `1.0` SHALL be used only through an explicitly identified legacy validation path. Every collection and object key SHALL use canonical stable ordering, repeated exports of unchanged source data SHALL be byte-identical, and the command SHALL write a locally inspectable artifact before any optional remote publication. Remote publication SHALL require a separate explicit authorized operation.

#### Scenario: A valid normalized registry is exported

- **WHEN** an engineer runs `php artisan registry:export-public` against complete valid local source data
- **THEN** the command exits successfully, writes the index and all language artifacts under the configured local export root, and identifies the represented schema version and snapshot identity

#### Scenario: A valid registry is exported

- **WHEN** an engineer runs `php artisan registry:export-public` against a valid normalized catalog
- **THEN** the command exits successfully, produces repeatable schema-conformant JSON artifacts, and identifies the computed snapshot represented by the output

#### Scenario: An invalid normalized registry is exported

- **WHEN** the selected source contains unresolved relationships, invalid PURLs, missing required languages, or schema-invalid values
- **THEN** the command exits non-zero, identifies the invalid data, and does not present a partial artifact tree as publishable

#### Scenario: An invalid registry is exported

- **WHEN** the selected normalized source contains unresolved or invalid data
- **THEN** the export command exits non-zero, identifies the invalid relationship, and produces no publishable artifact

#### Scenario: Export ordering is repeated

- **WHEN** the same normalized source is exported more than once without a source-data change
- **THEN** every artifact is byte-identical, including file names, collection ordering, object-key ordering, and snapshot identity

#### Scenario: Local export is requested without remote configuration

- **WHEN** an engineer runs the export command without R2 credentials or an authorized publication request
- **THEN** it writes only the configured local export root and does not contact or mutate remote storage

#### Scenario: Local export is requested

- **WHEN** an engineer runs the export command in the local backoffice
- **THEN** it writes only the configured local export root and does not upload, publish, or mutate remote storage implicitly

### Requirement: Backoffice configuration and administration are safe by default

The backoffice SHALL use environment-driven configuration, SHALL keep credentials and private keys outside tracked files, SHALL distinguish local panel access from production authorization, and SHALL not publish or mutate remote storage as an implicit side effect of ordinary local tests, administration, or local export. Any R2-compatible storage configuration SHALL be optional and SHALL be used only by the separately authorized publication boundary.

#### Scenario: Tracked configuration is inspected

- **WHEN** tracked backoffice files and example environment files are scanned
- **THEN** no password, token, private key, live database credential, or fabricated production resource identifier is present

#### Scenario: Local export runs without remote configuration

- **WHEN** an engineer runs the export command with no R2 credentials or remote publication target configured
- **THEN** local export remains available and no remote connection is attempted

### Requirement: PHP quality gates are available locally

The backoffice SHALL expose formatting/linting, application tests, configuration and route inspection, asset build, and coverage commands. Baseline tests SHALL use local or ephemeral test state and SHALL not require a production database, queue, or provider.

#### Scenario: A backoffice change is validated

- **WHEN** an engineer runs the documented PHP validation commands
- **THEN** formatting, boot, route/panel, registry validation, and application-test failures are reported as backoffice gates without external production dependencies

### Requirement: Normalized ecosystem relationships remain referentially valid

The backoffice SHALL enforce the required relationships among normalized ecosystem records. Package-category references required by packages and stack invariants SHALL remain non-null. Owned dependent records SHALL be removed only where the relationship is documented as cascading, optional references SHALL become empty when their optional parent is removed, and records that are still required by a publishable source SHALL not be left dangling. Language, runtime, category, and builder slugs SHALL be unique in their defined scope, and package slugs SHALL be unique within their package-manager scope.

#### Scenario: An owned parent is deleted

- **WHEN** an administrator deletes a language, package manager, documentation record, or builder with owned dependent records
- **THEN** the documented owned dependents are removed together and no dangling required reference remains

#### Scenario: An optional parent is deleted

- **WHEN** an administrator deletes an optional registry, runtime scope, or framework-package reference
- **THEN** the dependent record remains valid with that optional reference empty, or deletion is rejected if the record cannot remain valid

#### Scenario: A package is referenced by an invariant

- **WHEN** an administrator attempts to delete a package selected as an approved or banned invariant choice
- **THEN** deletion is rejected until the invariant reference is intentionally removed or changed

#### Scenario: A duplicate scoped slug is submitted

- **WHEN** an administrator submits a language, runtime, category, builder, or package slug that conflicts within its uniqueness scope
- **THEN** validation rejects the record and identifies the conflicting scope

### Requirement: Stack invariants support global and runtime-scoped policy

The backoffice SHALL allow a stack invariant to identify a category, distinct approved and banned packages, an optional target runtime, an optional framework-package scope, a severity, a reason, and an optional replacement example and migration URL. An invariant without a target runtime SHALL apply globally; an invariant with a target runtime SHALL apply only to that runtime.

#### Scenario: An invariant uses the same package twice

- **WHEN** an invariant is saved with the same package as its approved and banned choice
- **THEN** validation rejects the save and explains that the choices must be distinct

#### Scenario: An invariant has a runtime scope

- **WHEN** an invariant has a target runtime
- **THEN** consumers applying the policy include it only for that runtime

#### Scenario: An invariant has no runtime scope

- **WHEN** an invariant has no target runtime
- **THEN** consumers applying the policy treat it as globally applicable

### Requirement: Administrators can manage normalized ecosystem records

The authenticated administration panel SHALL provide workflows for programming languages, package managers, packages, and stack invariants. Language administration SHALL support reviewable slug generation and extension tags plus runtime and package-manager relationships. Package-manager administration SHALL expose its language, optional registry/PURL configuration, manifest, lockfile, install, add, binary, and workspace settings. Package administration SHALL expose category, opinionated choice, and Markdown rationale. Invariant administration SHALL expose distinct approved and banned package selectors, optional runtime scope, severity, reason, migration URL, and a syntax-readable replacement example.

#### Scenario: A language slug is generated

- **WHEN** an administrator enters a language name without manually changing the slug
- **THEN** the form proposes a stable slug that can be reviewed before saving

#### Scenario: A language’s relationships are managed

- **WHEN** an administrator opens a programming language record
- **THEN** the panel provides workflows for its runtimes and package managers without requiring an unrelated resource navigation path

#### Scenario: A package manager is configured

- **WHEN** an administrator edits manifest, lockfile, registry/PURL, workspace, and command fields
- **THEN** the panel validates the configuration and persists the selected relationships and values without accepting unsupported enum values

#### Scenario: An invariant is edited

- **WHEN** an administrator selects approved and banned packages, an optional runtime, severity, reason, and replacement example
- **THEN** the form presents the invariant scope and code in a readable form and prevents selecting the same package twice

### Requirement: The backoffice provides an authenticated candidate-ingestion boundary

The backoffice SHALL provide a versioned `POST /api/v1/ingest/packages` boundary for explicitly enabled crawler synchronization. The boundary SHALL require a dedicated revocable ingestion token with least-privilege scope, SHALL validate the envelope structure before persistence and validate each candidate against the shared candidate contract before accepting it, SHALL enforce request and batch limits, and SHALL keep credentials and authorization material out of logs and responses.

#### Scenario: A valid ingestion request is authenticated

- **WHEN** a caller submits a supported candidate batch with an active ingestion token and within configured limits
- **THEN** the boundary validates the envelope and returns a machine-readable batch outcome without requiring panel authentication

#### Scenario: An unauthenticated request is submitted

- **WHEN** a caller omits, invalidates, or lacks the ingestion scope for the bearer token
- **THEN** the boundary rejects the request without revealing token validity details or mutating candidate state

#### Scenario: An oversized batch is submitted

- **WHEN** a caller exceeds the configured request bytes or candidate count
- **THEN** the boundary rejects the request before persistence and reports the applicable limit without echoing the request contents

### Requirement: Candidate ingestion is idempotent staging, not direct catalog publication

The backoffice SHALL persist accepted candidates and their provenance in a staging/audit boundary keyed by crawl identity, source identity, and canonical PURL. Replayed candidate batches SHALL be idempotent. Ingestion SHALL NOT directly create or overwrite publishable normalized package records, package categories, framework relationships, opinionated choices, public artifacts, or R2 objects.

#### Scenario: A new candidate is ingested

- **WHEN** a valid candidate has not previously been staged for the same crawl and canonical identity
- **THEN** the backoffice stores the candidate, evidence, source revision, and ingest outcome as reviewable staging data

#### Scenario: A candidate batch is replayed

- **WHEN** the same crawl identity and candidate identity are submitted again
- **THEN** the boundary returns a duplicate or prior outcome and does not create a second staged candidate or mutate the existing source evidence unexpectedly

#### Scenario: A staged candidate is exported

- **WHEN** `registry:export-public` runs after candidate ingestion but before explicit review and normalization
- **THEN** the export uses only the governed normalized source and does not include staged candidates as implicit catalog records

### Requirement: Candidate outcomes are transactional, attributable, and readable after ingestion

The boundary SHALL distinguish envelope rejection from per-candidate validation rejection, duplicate acceptance, and retryable persistence or provider conditions. Each accepted or rejected candidate SHALL have an auditable outcome that can be read back independently after the request completes. A valid candidate artifact SHALL remain locally inspectable even if synchronization is unavailable.

#### Scenario: A batch contains valid and invalid candidates

- **WHEN** the envelope is valid but individual candidates fail PURL, provenance, or safety validation
- **THEN** valid candidates are committed atomically per candidate, invalid candidates are not persisted as accepted staging records, and the response identifies every outcome by stable candidate identity

#### Scenario: Persistence fails during a candidate write

- **WHEN** a candidate cannot be committed
- **THEN** that candidate receives a retryable or failed outcome, no partial candidate record is reported as accepted, and previously committed independent candidates remain auditable

#### Scenario: Backoffice readback is performed

- **WHEN** an operator or integration test reads the recorded batch outcome after submission
- **THEN** the returned counts and candidate identities match the persisted staging records and no secret-bearing request value is returned

### Requirement: Review and normalization are explicit before public export

The backoffice SHALL provide an explicit path to resolve a staged candidate’s package manager, primary category, stable catalog identity, compatibility relationships, and administrator-owned opinionated choice before it can contribute to the normalized schema-2.0 source. Unresolved, conflicting, or incomplete candidate evidence SHALL remain staged or be rejected with actionable diagnostics.

#### Scenario: A staged candidate is approved

- **WHEN** an authorized operator resolves its catalog relationships and accepts its evidence
- **THEN** the resulting normalized records satisfy existing relational and schema requirements and can be considered by the ordinary deterministic export path

#### Scenario: A staged candidate has conflicting sources

- **WHEN** registry and curated evidence disagree on a material field
- **THEN** the candidate remains visibly conflicted until an authorized review decision records the selected normalized value and rationale

#### Scenario: A staged candidate is incomplete

- **WHEN** a candidate lacks a required catalog identity or relationship
- **THEN** it cannot enter the publishable normalized source and the diagnostic identifies the missing resolution

### Requirement: Candidate ingestion is safe by default in local environments

Candidate ingestion SHALL be disabled or non-publishing by default in local configurations, SHALL use environment-driven endpoint and token configuration, SHALL not require R2 or production services for artifact validation or local review, and SHALL preserve the separate explicit authorization required by the existing R2 publisher.

#### Scenario: Local validation runs without remote services

- **WHEN** a developer validates or imports a local candidate artifact without production credentials
- **THEN** schema validation and local staging tests run without contacting R2 or requiring an external database/provider

#### Scenario: A crawler attempts implicit publication

- **WHEN** a crawl completes without an explicit reviewed export and authorized publication operation
- **THEN** no public catalog artifact is published and no R2 mutation is attempted
