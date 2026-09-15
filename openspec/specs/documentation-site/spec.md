# documentation-site Specification

## Purpose

Provide a Docusaurus v3 TypeScript documentation site that explains SibylHub’s workspace contracts and governance while producing a deterministic static artifact for publication.

## Requirements

### Requirement: Documentation covers the platform contract

The documentation site SHALL provide a working introduction route and documentation pages covering workspace boundaries and commands, `.agent/` governance, AST/Socraticode compression concepts, Context7 architecture, shared schemas, and deployment/security boundaries.

#### Scenario: The introduction is viewed locally
- **WHEN** an engineer starts the documented documentation server and opens the introduction route
- **THEN** the site renders the platform overview and links to the requested application and governance documentation without broken internal routes

### Requirement: Documentation reflects executable commands and boundaries

The documentation SHALL describe commands and paths that match the repository’s current manifests and SHALL distinguish local build/test evidence from Cloudflare deployment, remote synchronization, database, and production runtime evidence.

#### Scenario: A command guide is followed
- **WHEN** an engineer follows a documented setup, development, or validation command
- **THEN** the command maps to an available workspace or package task and its stated local/remote side effects are accurate

### Requirement: The documentation site produces a static publication artifact

The documentation site SHALL provide a production build that emits a self-contained static artifact, SHALL fail on broken links or invalid configuration, and SHALL not require a running backend, production database, credentials, or remote synchronization service.

#### Scenario: Documentation is built for publication
- **WHEN** the production docs build command completes
- **THEN** the output directory is non-empty, contains the baseline route and referenced documents, and is suitable for a static host without an application server

#### Scenario: Documentation contains an invalid internal link
- **WHEN** a documentation build includes a broken internal route or invalid configuration
- **THEN** the build exits non-zero and identifies the broken reference before producing a publishable result

### Requirement: Documentation quality checks are locally available

The documentation site SHALL expose development, build, type checking, linting, formatting, validation, and cleaning commands with deterministic local behavior.

#### Scenario: A documentation change is validated
- **WHEN** an engineer runs the documented docs validation commands
- **THEN** content, TypeScript, configuration, formatting, and build failures are reported before publication and no remote mutation occurs
