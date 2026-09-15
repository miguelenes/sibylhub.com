## MODIFIED Requirements

### Requirement: Shared contracts have versioned machine-readable representations

The shared schema package SHALL publish self-contained, versioned JSON Schema artifacts and a TypeScript validation interface for ecosystem definitions, `.agent/config.json`, `.agent/skills.json`, and stack-invariant rules. The ecosystem contract SHALL define the schema `2.0` split artifact set consisting of `data/v1/index.json` and `data/v1/languages/{slug}.json`. Schema `1.0` SHALL remain available only through an explicitly identified legacy validation path. Each artifact set SHALL identify its schema version and snapshot identity, SHALL reject unknown required-version incompatibilities rather than silently accepting them, and SHALL define reference and path rules for the index and language files. A consumer importing the packaged distribution SHALL NOT require source files that are excluded from the package artifact.

#### Scenario: A consumer validates a supported split artifact set
- **WHEN** a consumer validates an index and its referenced language files against the declared schema version
- **THEN** a conforming artifact set is accepted and the validation result identifies the selected version and snapshot identity

#### Scenario: A consumer validates a supported document
- **WHEN** a consumer validates a document against the declared schema version
- **THEN** a conforming document is accepted and the validation result identifies the selected version

#### Scenario: A consumer receives an unsupported schema version
- **WHEN** an artifact set declares a schema version that the consumer does not support
- **THEN** validation fails with a machine-readable compatibility error and does not reinterpret the artifact set as an older version

#### Scenario: A consumer imports the packaged distribution
- **WHEN** a consumer installs or imports the built shared schema package without repository source files
- **THEN** the exported validators, types, catalog helpers, and schema artifacts resolve from the package's declared files and do not fail with a missing source-module error

### Requirement: Ecosystem definitions represent the complete registry vocabulary

The ecosystem contract SHALL represent the complete configured catalog of exactly 25 target programming language identities and their runtimes, package registries, package managers, lockfile specifications, workspace configurations, package categories, packages, compatibility relationships, builders, stack invariants, and documentation references. The master index SHALL provide stable language and builder identities and language-file references. Each language artifact SHALL contain the records scoped to that language, and every reference SHALL resolve by a stable identifier without relying on an implicit default. The published catalog SHALL validate required fields and PURLs and SHALL reject incomplete entries.

#### Scenario: A complete split artifact set is validated
- **WHEN** an index references one valid language artifact for each target language and every artifact contains its required relationships
- **THEN** the complete catalog validates and each relationship resolves by its stable identifier

#### Scenario: A complete ecosystem entry is validated
- **WHEN** an ecosystem document includes a supported language, runtime, package manager, lockfile, builder, invariant, and documentation relationship
- **THEN** the document validates and each relationship can be resolved by its stable identifier

#### Scenario: An ecosystem entry is incomplete
- **WHEN** a language artifact omits a required relationship or references an unknown stable identifier
- **THEN** validation fails with the missing or unresolved field and the artifact set is not publishable

#### Scenario: A catalog entry has incomplete package identity
- **WHEN** a catalog entry contains an incomplete PURL or omits a required identity field
- **THEN** validation fails at the affected entry and no substitute package identity is inferred

### Requirement: Package URLs use a canonical portable contract

The shared contract SHALL validate package URLs according to the PURL specification, SHALL preserve the package type, namespace, name, version, qualifiers, and subpath when present, and SHALL provide a normalized representation suitable for comparison across package managers.

#### Scenario: A valid package URL is normalized
- **WHEN** a consumer submits a syntactically valid PURL with optional qualifiers or subpath
- **THEN** validation succeeds and returns a canonical representation without dropping meaningful components

#### Scenario: An invalid package URL is submitted
- **WHEN** a consumer submits a malformed or incomplete PURL
- **THEN** validation fails with a field-level diagnostic and no guessed package identity is emitted

### Requirement: Agent and invariant documents are safe to consume

The `.agent/` and stack-invariant contracts SHALL distinguish declarative project metadata from executable instructions, SHALL validate allowed fields and types, and SHALL reject embedded credentials, private keys, or unsupported execution directives.

#### Scenario: A project configuration is inspected
- **WHEN** a valid `.agent/config.json`, skills document, or invariant rule is loaded
- **THEN** it yields declarative metadata and validation rules without requiring code execution or network access

#### Scenario: A secret-bearing or executable field is supplied
- **WHEN** a document contains a credential, private key, or unsupported executable directive
- **THEN** schema validation fails and the value is not returned as an accepted contract field

### Requirement: Contract artifacts are consumable by every workspace boundary

The shared package SHALL expose deterministic artifacts that the web, backoffice, backend, CLI, and documentation site can validate or document without importing a second incompatible definition of the same contract. The build SHALL regenerate the complete split artifact schema set, compiled TypeScript exports, and cross-runtime fixtures from the canonical contract definitions and SHALL make the generated output available to package consumers.

#### Scenario: Multiple applications consume one contract
- **WHEN** the TypeScript, PHP, Rust, and documentation workflows validate the same versioned split artifact fixture
- **THEN** they agree on its schema version, snapshot identity, validity, stable identifiers, and rejection of the same invalid fixture

#### Scenario: A contract artifact is regenerated
- **WHEN** the shared package build runs from a clean generated-output directory
- **THEN** all declared JSON Schema files, compiled TypeScript exports, and validation fixtures are recreated deterministically without depending on stale source-relative imports

## ADDED Requirements

### Requirement: Split registry artifacts remain cross-file consistent

The shared contract SHALL require the index and every language file in one artifact set to declare the same schema version and snapshot identity. File paths SHALL be derived from canonical language slugs, the index SHALL reference exactly the required language files, collections SHALL use stable ordering, and no generated timestamp or other volatile field SHALL make an unchanged export differ.

#### Scenario: Index and language identities disagree
- **WHEN** a language file declares a different schema version or snapshot identity from the index
- **THEN** validation fails and the artifact set is not publishable

#### Scenario: A language slug does not match its file path
- **WHEN** a language artifact is stored under a path that does not match its canonical slug
- **THEN** validation fails with a path and identity diagnostic

#### Scenario: An unchanged source is serialized twice
- **WHEN** the same canonical source is serialized twice
- **THEN** the complete artifact tree has identical file names, bytes, and collection ordering
