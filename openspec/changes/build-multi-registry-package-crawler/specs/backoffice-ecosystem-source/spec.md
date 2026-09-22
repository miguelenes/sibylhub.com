## ADDED Requirements

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
