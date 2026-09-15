## MODIFIED Requirements

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

## ADDED Requirements

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
