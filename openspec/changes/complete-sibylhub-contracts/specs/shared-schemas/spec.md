## MODIFIED Requirements

### Requirement: Shared contracts have versioned machine-readable representations

The shared schema package SHALL publish self-contained, versioned JSON Schema artifacts and a TypeScript validation interface for ecosystem definitions, `.agent/config.json`, `.agent/skills.json`, and stack-invariant rules. Each artifact SHALL identify its schema version and SHALL reject unknown required-version incompatibilities rather than silently accepting them. A consumer importing the packaged distribution SHALL NOT require source files that are excluded from the package artifact.

#### Scenario: A consumer validates a supported document
- **WHEN** a consumer validates a document against the declared schema version
- **THEN** a conforming document is accepted and the validation result identifies the selected version

#### Scenario: A consumer receives an unsupported schema version
- **WHEN** a document declares a schema version that the consumer does not support
- **THEN** validation fails with a machine-readable compatibility error and does not reinterpret the document as an older version

#### Scenario: A consumer imports the packaged distribution
- **WHEN** a consumer installs or imports the built shared schema package without repository source files
- **THEN** the exported validators, types, catalog helpers, and schema artifacts resolve from the package's declared files and do not fail with a missing source-module error

### Requirement: Ecosystem definitions represent the complete registry vocabulary

The ecosystem contract SHALL represent the configured catalog of target programming languages, runtimes, package managers, lockfile specifications, builders, stack invariants, and documentation references. The published catalog SHALL contain an explicit entry for each of the 25 target language identities, SHALL validate the required fields of every catalog entry and PURL, and SHALL reject incomplete entries that omit their required compatibility relationships.

#### Scenario: A complete ecosystem entry is validated
- **WHEN** an ecosystem document includes a supported language, runtime, package manager, lockfile, builder, invariant, and documentation relationship
- **THEN** the document validates and each relationship can be resolved by its stable identifier

#### Scenario: An ecosystem entry is incomplete
- **WHEN** a document omits a required relationship or references an unknown stable identifier
- **THEN** validation fails with the missing or unresolved field and the invalid document is not publishable

#### Scenario: A catalog entry has incomplete package identity
- **WHEN** a catalog entry contains an incomplete PURL or omits a required identity field
- **THEN** validation fails at the affected entry and no substitute package identity is inferred

### Requirement: Contract artifacts are consumable by every workspace boundary

The shared package SHALL expose deterministic artifacts that the web, backoffice, backend, CLI, and documentation site can validate or document without importing a second incompatible definition of the same contract. The build SHALL regenerate the complete artifact set from the canonical contract definitions and SHALL make the generated output available to package consumers and cross-runtime fixture tests.

#### Scenario: Multiple applications consume one contract
- **WHEN** the TypeScript, PHP, Rust, and documentation workflows validate the same versioned fixture
- **THEN** they agree on its schema version, validity, stable identifiers, and rejection of the same invalid fixture

#### Scenario: A contract artifact is regenerated
- **WHEN** the shared package build runs from a clean generated-output directory
- **THEN** all declared JSON Schema files, compiled TypeScript exports, and validation fixtures are recreated deterministically without depending on stale source-relative imports
