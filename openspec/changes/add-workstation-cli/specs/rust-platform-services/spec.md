## MODIFIED Requirements

### Requirement: `sibyl init` creates governed local project metadata

The CLI SHALL provide `sibyl init`, SHALL inspect `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, and `composer.json` when present without executing project code, SHALL detect the associated language/runtime, package manager, and available lockfile evidence, and SHALL generate schema-valid JSON `.agent/` documents plus fixed safe templates from that evidence. A successful initialization SHALL create `.agent/config.json`, `.agent/rules.md`, `.agent/skills.json`, `.agent/memories.json`, and `.agent/context.ignore` when those files do not exist. Initialization SHALL report conflicts or existing incompatible configuration before overwriting it, SHALL preserve existing governance files unless `--force` is explicit, and SHALL emit no executable directive or credential material.

#### Scenario: A project is initialized
- **WHEN** an operator runs `sibyl init` in a repository containing supported manifests
- **THEN** the CLI writes schema-valid `.agent/` metadata for the detected stacks, reports each created file, and exits successfully

#### Scenario: Multiple runtimes are detected
- **WHEN** a repository contains supported manifests for JavaScript or TypeScript, Rust, Python, Go, or PHP
- **THEN** the generated configuration records each manifest, its detected runtime ownership, its package-manager identity when known, and its lockfile evidence when present

#### Scenario: Initialization finds supported manifests
- **WHEN** a repository contains one or more supported package, workspace, runtime, or documentation manifests
- **THEN** the generated configuration records the detected manifest evidence, maps each detected runtime to an owner, declares only safe inspection commands, and preserves the required explicit-remote-mutation and separate-remote-evidence controls

#### Scenario: Initialization encounters existing governance files
- **WHEN** `sibyl init` finds any target `.agent/` file or existing metadata that conflicts with the generated result
- **THEN** it exits non-zero with the conflicting paths and does not replace them unless the operator supplies the documented `--force` option

#### Scenario: Initialization encounters an existing incompatible configuration
- **WHEN** `sibyl init` finds existing `.agent/` content that conflicts with detected metadata
- **THEN** it exits non-zero or requests the documented explicit overwrite mode and does not silently discard existing governance data

#### Scenario: Initialization finds no supported manifest
- **WHEN** a repository contains no supported primary manifest or supplementary stack evidence
- **THEN** the CLI reports that no supported stack was detected, does not claim a detected runtime, and exits non-zero without writing partial governance metadata

#### Scenario: Generated metadata is inspected
- **WHEN** an operator reads the files produced by a successful initialization
- **THEN** the files contain declarative metadata, the required safe-command and remote-evidence controls, and no credentials, private keys, or executable instructions

### Requirement: `sibyl check` validates stack invariants without mutation

The CLI SHALL provide `sibyl check`, SHALL load the selected `.agent/` configuration and invariant metadata together with supported manifest evidence, SHALL parse supported manifests and available lockfiles without executing project code or resolving dependencies, SHALL compare every detected dependency against selected local stack invariants, and SHALL obtain package-ban relationships only from an explicitly supplied local registry snapshot. It SHALL report every violation with stable diagnostics. The command SHALL support machine-readable JSON output and a dense ANSI-capable terminal table containing the affected package, severity, reason, approved replacement, and a `banned -> approved` replacement rendering when applicable. It SHALL return non-zero when the project is not compliant or when required evidence is invalid. The command SHALL not execute project code, install dependencies, contact a remote service, or modify the project. A registry option or environment setting SHALL refer only to a local source; the command SHALL not fall back to a remote API.

#### Scenario: A project satisfies its invariants
- **WHEN** an operator runs `sibyl check` against a project whose detected dependencies and configuration satisfy the selected rules
- **THEN** the CLI exits successfully and reports a machine-readable compliant result with no violations

#### Scenario: A project violates a package invariant
- **WHEN** a project manifest or lockfile contains a dependency banned by the selected local policy
- **THEN** the CLI exits non-zero, reports every matched violation with the package, severity, reason, and approved replacement, and renders the replacement as `banned -> approved` in human-readable output

#### Scenario: A project violates an invariant
- **WHEN** an operator runs `sibyl check` against a project with a missing, incompatible, or disallowed dependency or configuration
- **THEN** the CLI exits non-zero, identifies the violated invariant and evidence, and does not modify the project

#### Scenario: Multiple violations are present
- **WHEN** more than one dependency violates the selected policies
- **THEN** the CLI reports all violations in deterministic package and severity order rather than stopping at the first match

#### Scenario: JSON output is requested
- **WHEN** an operator runs `sibyl check --json`
- **THEN** the CLI emits valid machine-readable JSON without ANSI escape sequences and includes the aggregate compliance result and all diagnostics

#### Scenario: A project has malformed governance or manifest metadata
- **WHEN** `.agent/config.json`, a selected invariant source, a supported manifest, or a required lockfile is missing required fields, declares an unsupported version, or contains invalid syntax
- **THEN** the CLI exits non-zero with field- or path-level diagnostics and performs no project or network mutation

#### Scenario: A project has malformed governance metadata
- **WHEN** `.agent/config.json` or a selected invariant document is missing required fields, declares an unsupported version, or contains unsafe content
- **THEN** the CLI exits non-zero with field-level diagnostics and performs no project or network mutation

#### Scenario: No local package policy source is configured
- **WHEN** the project has detected dependencies and no local registry snapshot is supplied
- **THEN** the CLI performs governance and manifest checks, reports package policy as not configured, exits non-zero, and does not claim compliance or contact a remote service

#### Scenario: The check source is remote or unavailable
- **WHEN** the operator supplies a remote registry URL or the selected local registry source cannot be read or validated
- **THEN** the CLI rejects the source safely, does not contact the remote URL, and exits non-zero without claiming compliance

### Requirement: `sibyl sync` uses explicit edge authorization and bounded effects

The CLI SHALL provide `sibyl sync` for episodic-memory and AST-skeleton synchronization, SHALL require a payload path, an HTTPS endpoint supplied through the documented configuration, and an authorization value supplied through the environment, SHALL validate the payload against the supported schema and secret-content rules before transmission, and SHALL report remote failures without exposing credentials or silently claiming convergence. It SHALL use bounded request timeouts and retries, and it SHALL report a remote acknowledgement or revision only after receiving a successful response. `sibyl sync` SHALL be the only command permitted to contact a remote service.

#### Scenario: A synchronization request is authorized
- **WHEN** an operator runs `sibyl sync` with a valid local payload, an HTTPS endpoint, an authorization value, and reachable service
- **THEN** the CLI validates the payload, performs the synchronization, and reports the remote acknowledgement or revision

#### Scenario: Synchronization prerequisites are absent
- **WHEN** the endpoint, authorization, payload path, or payload validation is missing or invalid
- **THEN** the CLI exits non-zero, identifies the failed prerequisite, performs no request, and does not print secret values

#### Scenario: The configured endpoint is unsafe
- **WHEN** the configured endpoint is not HTTPS or embeds credentials in its URL
- **THEN** the CLI rejects it before transmission and does not contact the endpoint

#### Scenario: Remote synchronization fails
- **WHEN** the remote service returns a failure or bounded transport retries are exhausted
- **THEN** the CLI exits non-zero with a safe failure diagnostic and does not report convergence or a fabricated acknowledgement

#### Scenario: A non-sync command is invoked
- **WHEN** an operator runs `sibyl init`, `sibyl check`, or `sibyl memory add`
- **THEN** the command performs no network request, regardless of whether synchronization configuration exists in the environment

## ADDED Requirements

### Requirement: `sibyl memory add` appends declarative local memory

The CLI SHALL provide `sibyl memory add <title> <content> --category <category>`, SHALL validate non-empty title, content, and category values, and SHALL append one schema-valid declarative memory entry to `.agent/memories.json`. It SHALL create the document when absent, preserve existing valid entries, reject malformed or unsafe existing documents without rewriting them, and perform no network access or project-code execution. The command SHALL report the added entry and return non-zero for invalid input or write failures.

#### Scenario: An invariant memory is added
- **WHEN** an operator supplies a title, content, and `--category invariant` in a project with no memory document
- **THEN** the CLI creates `.agent/memories.json` with the versioned memory document and one entry containing the supplied values

#### Scenario: An entry is appended to existing memories
- **WHEN** `.agent/memories.json` contains valid entries and the operator adds another memory
- **THEN** the CLI preserves the existing entries, appends exactly one new entry, and keeps the document deterministically serializable

#### Scenario: Memory input is invalid or unsafe
- **WHEN** the title, content, or category is empty, or the new entry contains prohibited credential or executable-instruction material
- **THEN** the CLI exits non-zero and leaves `.agent/memories.json` unchanged

#### Scenario: The memory document is malformed
- **WHEN** `.agent/memories.json` is not valid according to the supported declarative schema
- **THEN** the CLI reports the document error, does not overwrite it, and performs no network request
