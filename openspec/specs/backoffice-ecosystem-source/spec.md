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

The backoffice SHALL expose a configured Filament 5 panel route, SHALL keep panel configuration and registry administration inside the backoffice application boundary, and SHALL return either the panel shell or an explicit authentication/authorization response rather than a missing-route or bootstrap error.

#### Scenario: The panel route is requested locally
- **WHEN** the configured panel route is requested while the local application is running
- **THEN** the response is a Filament panel shell or an explicit authentication/authorization response with no framework bootstrap failure

### Requirement: The registry stores complete ecosystem source data

The backoffice SHALL maintain versioned, uniquely identifiable records for the 25 target programming languages and their runtimes, package managers, lockfile specifications, builders, stack invariants, and documentation references. It SHALL reject publication of incomplete or unresolved relationships.

#### Scenario: A registry revision is submitted
- **WHEN** an administrator submits a registry revision containing all required relationships and valid shared-schema identifiers
- **THEN** the revision is accepted with a stable revision identity and can be validated for public export

#### Scenario: A registry revision is incomplete
- **WHEN** a revision omits a required compatibility relationship or references an unknown schema identifier
- **THEN** the backoffice rejects the revision with actionable validation errors and does not mark it publishable

### Requirement: Public registry export is deterministic and schema-conformant

The backoffice SHALL provide `php artisan registry:export-public`, SHALL generate deterministic JSON payloads conforming to the shared schemas, SHALL include the selected registry revision, and SHALL write a locally inspectable export before any optional remote publication. A remote upload SHALL require a separately explicit authorized operation.

#### Scenario: A valid registry is exported
- **WHEN** an engineer runs `php artisan registry:export-public` against a valid revision
- **THEN** the command exits successfully, produces repeatable schema-conformant JSON artifacts, and identifies the revision represented by the output

#### Scenario: An invalid registry is exported
- **WHEN** the selected registry contains unresolved or invalid data
- **THEN** the export command exits non-zero, identifies the invalid relationship, and produces no publishable artifact

### Requirement: Backoffice configuration and administration are safe by default

The backoffice SHALL use environment-driven configuration, SHALL keep credentials and private keys outside tracked files, SHALL distinguish local panel access from production authorization, and SHALL not publish or mutate remote storage as an implicit side effect of ordinary local tests or administration.

#### Scenario: Tracked configuration is inspected
- **WHEN** tracked backoffice files and example environment files are scanned
- **THEN** no password, token, private key, live database credential, or fabricated production resource identifier is present

### Requirement: PHP quality gates are available locally

The backoffice SHALL expose formatting/linting, application tests, configuration and route inspection, asset build, and coverage commands. Baseline tests SHALL use local or ephemeral test state and SHALL not require a production database, queue, or provider.

#### Scenario: A backoffice change is validated
- **WHEN** an engineer runs the documented PHP validation commands
- **THEN** formatting, boot, route/panel, registry validation, and application-test failures are reported as backoffice gates without external production dependencies
