## Purpose

Provide versioned, language-neutral contracts that keep ecosystem metadata, agent configuration, skills, package URLs, and stack invariants consistent across all SibylHub applications.

## ADDED Requirements

### Requirement: Shared contracts have versioned machine-readable representations

The shared schema package SHALL publish versioned JSON Schema artifacts and a TypeScript validation interface for ecosystem definitions, `.agent/config.json`, `.agent/skills.json`, and stack-invariant rules. Each artifact SHALL identify its schema version and SHALL reject unknown required-version incompatibilities rather than silently accepting them.

#### Scenario: A consumer validates a supported document
- **WHEN** a consumer validates a document against the declared schema version
- **THEN** a conforming document is accepted and the validation result identifies the selected version

#### Scenario: A consumer receives an unsupported schema version
- **WHEN** a document declares a schema version that the consumer does not support
- **THEN** validation fails with a machine-readable compatibility error and does not reinterpret the document as an older version

### Requirement: Ecosystem definitions represent the complete registry vocabulary

The ecosystem contract SHALL represent the configured catalog of target programming languages, runtimes, package managers, lockfile specifications, builders, stack invariants, and documentation references. The published catalog SHALL contain an explicit entry for each of the 25 target language identities and SHALL reject incomplete entries that omit their required compatibility relationships.

#### Scenario: A complete ecosystem entry is validated
- **WHEN** an ecosystem document includes a supported language, runtime, package manager, lockfile, builder, invariant, and documentation relationship
- **THEN** the document validates and each relationship can be resolved by its stable identifier

#### Scenario: An ecosystem entry is incomplete
- **WHEN** a document omits a required relationship or references an unknown stable identifier
- **THEN** validation fails with the missing or unresolved field and the invalid document is not publishable

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

The shared package SHALL expose deterministic artifacts that the web, backoffice, backend, CLI, and documentation site can validate or document without importing a second incompatible definition of the same contract.

#### Scenario: Multiple applications consume one contract
- **WHEN** the TypeScript, PHP, Rust, and documentation workflows validate the same versioned fixture
- **THEN** they agree on its schema version, validity, stable identifiers, and rejection of the same invalid fixture

