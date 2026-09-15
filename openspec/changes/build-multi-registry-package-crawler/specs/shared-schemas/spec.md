## ADDED Requirements

### Requirement: Shared schemas define a separate candidate-ingestion contract

The shared schema package SHALL publish a versioned machine-readable candidate-ingestion envelope distinct from the schema-2.0 complete public catalog. The candidate contract SHALL support crawl identity, source coverage, stable PURLs, release metadata, category and framework detections, advisory choice assessments, attributed evidence, diagnostics, and telemetry while allowing unresolved candidates to remain staged rather than forcing them into the normalized catalog vocabulary.

#### Scenario: A valid candidate batch is validated
- **WHEN** a consumer validates a candidate-ingestion artifact with a supported candidate schema version and stable PURLs
- **THEN** validation succeeds and exposes the crawl identity, candidates, evidence, diagnostics, and telemetry without requiring all 25 catalog language artifacts

#### Scenario: A candidate references an unresolved catalog identity
- **WHEN** a candidate has a valid registry and PURL but no resolved `packageManagerId` or `categoryId`
- **THEN** the candidate contract accepts the unresolved state with an explicit resolution status and does not invent a catalog relationship

### Requirement: Candidate evidence and provenance are attributed and bounded

The candidate contract SHALL require source identity, canonical source URL, retrieval time, evidence type, and content identity for observations used in normalization or classification. It SHALL bound excerpt and raw-response fields, SHALL distinguish registry facts from curated opinions, and SHALL reject credentials, private keys, bearer tokens, and unsupported executable directives.

#### Scenario: A detection cites source evidence
- **WHEN** a candidate includes a framework or category detection
- **THEN** the detection resolves to one or more attributed evidence records with classifier version and rationale

#### Scenario: An unsafe evidence record is submitted
- **WHEN** an evidence field contains a credential, private key, or bearer token
- **THEN** validation rejects or redacts the record and reports a field-level diagnostic

### Requirement: Candidate schema versions are not reinterpreted as public catalog versions

The shared validators SHALL reject unsupported candidate schema versions and SHALL not reinterpret a candidate artifact as a schema-2.0 public catalog or a legacy schema-1.0 document. Candidate and public-catalog validators SHALL remain independently addressable in the packaged distribution.

#### Scenario: An unsupported candidate version is received
- **WHEN** a candidate artifact declares a version that the validator does not support
- **THEN** validation fails with a machine-readable compatibility error and no candidate is returned as accepted

#### Scenario: A candidate artifact is passed to the catalog validator
- **WHEN** a consumer attempts to validate a candidate artifact with the complete public-catalog validator
- **THEN** validation fails with an artifact-kind or contract mismatch rather than coercing candidate fields into catalog records

### Requirement: Candidate contract artifacts are consumable across workspace boundaries

The shared package SHALL expose candidate types, validators, schema artifacts, and fixtures through its packaged exports so the scraper and Laravel integration tests can validate identical accepted and rejected candidate batches without importing source-relative files.

#### Scenario: A packaged consumer validates a candidate
- **WHEN** the built shared package is installed without repository source files
- **THEN** candidate validators and schema artifacts resolve from declared package exports and validate the same fixtures as the repository source build
