## MODIFIED Requirements

### Requirement: Ecosystem and invariant API behavior is explicit

The backend SHALL expose `GET /v1/ecosystems` through a documented JSON response contract backed by shared schema identities, SHALL expose stack-invariant validation through a documented request/response contract, and SHALL distinguish client validation failures from internal failures. Invariant validation SHALL require structured project evidence, SHALL evaluate that evidence against the selected language and invariant in the loaded registry snapshot, and SHALL reject a request that provides only a legacy client-supplied compliance assertion. A client-supplied compliance result SHALL NOT determine the response.

#### Scenario: Ecosystem metadata is requested

- **WHEN** a client requests `GET /v1/ecosystems` with valid configuration
- **THEN** the backend returns a successful schema-identifiable response containing the available ecosystem metadata or an explicitly documented empty result

#### Scenario: A request fails validation

- **WHEN** a client submits malformed or invariant-violating input
- **THEN** the backend returns the documented client-error status and structured error body without terminating the server

#### Scenario: A legacy compliance assertion is submitted

- **WHEN** a client submits `compliant` without the structured evidence required by the selected invariant
- **THEN** the backend returns a stable structured client-validation error and does not treat the assertion as proof

#### Scenario: Evidence satisfies a selected invariant

- **WHEN** a client submits a known language, a known invariant associated with that language, and evidence satisfying the invariant rule
- **THEN** the backend returns a successful valid result derived from the evidence and registry snapshot

#### Scenario: Evidence violates a selected invariant

- **WHEN** a client submits a known language and invariant with missing, incompatible, or disallowed evidence
- **THEN** the backend returns a structured invalid result with stable diagnostics and does not accept a caller-provided compliance assertion as proof

### Requirement: `sibyl init` creates governed local project metadata

The CLI SHALL provide `sibyl init`, SHALL inspect supported local repository manifests without executing project code, SHALL generate schema-valid `.agent/` configuration from detected metadata, and SHALL report conflicts or an existing incompatible configuration before overwriting it. Generated configuration SHALL include the required runtime ownership, safe-command, and remote-evidence controls and SHALL contain no executable directive or credential material.

#### Scenario: A project is initialized

- **WHEN** an operator runs `sibyl init` in a repository containing supported manifests
- **THEN** the CLI writes schema-valid `.agent/` metadata describing detected stacks and reports the files created

#### Scenario: Initialization encounters an existing incompatible configuration

- **WHEN** `sibyl init` finds existing `.agent/` content that conflicts with detected metadata
- **THEN** it exits non-zero or requests an explicit documented overwrite mode and does not silently discard existing governance data

#### Scenario: Initialization finds supported manifests

- **WHEN** a repository contains one or more supported package, workspace, runtime, or documentation manifests
- **THEN** the generated configuration records the detected manifest evidence, maps each detected runtime to an owner, declares only safe inspection commands, and preserves the required explicit-remote-mutation and separate-remote-evidence controls

### Requirement: `sibyl check` validates stack invariants without mutation

The CLI SHALL provide `sibyl check`, SHALL load the selected `.agent/` configuration and supported manifest evidence, SHALL compare detected or installed package metadata against the selected stack invariants and shared schemas, SHALL report every violation with stable diagnostics, and SHALL return non-zero when the project is not compliant. The command SHALL not execute project code, install dependencies, contact a remote service, or modify the project.

#### Scenario: A project satisfies its invariants

- **WHEN** an operator runs `sibyl check` against a project whose detected dependencies and configuration satisfy the selected rules
- **THEN** the CLI exits successfully and reports a machine-readable compliant result

#### Scenario: A project violates an invariant

- **WHEN** an operator runs `sibyl check` against a project with a missing, incompatible, or disallowed dependency/configuration
- **THEN** the CLI exits non-zero, identifies the violated invariant and evidence, and does not modify the project

#### Scenario: A project has malformed governance metadata

- **WHEN** `.agent/config.json` or a selected invariant document is missing required fields, declares an unsupported version, or contains unsafe content
- **THEN** the CLI exits non-zero with field-level diagnostics and performs no project or network mutation
