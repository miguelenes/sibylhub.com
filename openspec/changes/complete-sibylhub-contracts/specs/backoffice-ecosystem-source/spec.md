## MODIFIED Requirements

### Requirement: The registry stores complete ecosystem source data

The backoffice SHALL maintain versioned, uniquely identifiable records for the 25 target programming languages and their runtimes, package managers, lockfile specifications, builders, stack invariants, and documentation references. It SHALL reject publication of incomplete or unresolved relationships, and public export SHALL use a validated registry revision as its source rather than silently substituting a fixture or unrelated package-local fallback.

#### Scenario: A registry revision is submitted
- **WHEN** an administrator submits a registry revision containing all required relationships and valid shared-schema identifiers
- **THEN** the revision is accepted with a stable revision identity and can be validated for public export

#### Scenario: A registry revision is incomplete
- **WHEN** a revision omits a required compatibility relationship or references an unknown schema identifier
- **THEN** the backoffice rejects the revision with actionable validation errors and does not mark it publishable

#### Scenario: No validated registry revision is available
- **WHEN** an export is requested without an explicitly selected validated revision and no validated revision exists in local source-of-truth state
- **THEN** the command exits non-zero with an actionable diagnostic and does not present fixture data as a publishable registry revision

### Requirement: Public registry export is deterministic and schema-conformant

The backoffice SHALL provide `php artisan registry:export-public`, SHALL generate deterministic JSON payloads conforming to the shared schemas, SHALL include the selected registry revision, and SHALL write a locally inspectable export before any optional remote publication. Every exported collection SHALL use a stable ordering, repeated exports of unchanged source data SHALL be byte-identical, and a remote upload SHALL require a separately explicit authorized operation.

#### Scenario: A valid registry is exported
- **WHEN** an engineer runs `php artisan registry:export-public` against a valid revision
- **THEN** the command exits successfully, produces repeatable schema-conformant JSON artifacts, and identifies the revision represented by the output

#### Scenario: An invalid registry is exported
- **WHEN** the selected registry contains unresolved or invalid data
- **THEN** the export command exits non-zero, identifies the invalid relationship, and produces no publishable artifact

#### Scenario: Export ordering is repeated
- **WHEN** the same validated revision is exported more than once without a source-data change
- **THEN** every collection is serialized in the same stable order and the resulting bytes are identical

#### Scenario: Local export is requested
- **WHEN** an engineer runs the export command in the local backoffice
- **THEN** it writes only the configured local export root and does not upload, publish, or mutate remote storage implicitly
