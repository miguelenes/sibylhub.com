# Spec Delta

## MODIFIED Requirements

### Requirement: Documentation covers the platform contract

The documentation site SHALL provide a working introduction route and documentation pages covering workspace boundaries and commands, `.agent/` governance, AST/Socraticode compression concepts, Context7 architecture, shared schemas, the SibylHub Gateway's role and integration boundary, and deployment/security boundaries.

#### Scenario: The introduction is viewed locally
- **WHEN** an engineer starts the documented documentation server and opens the introduction route
- **THEN** the site renders the platform overview and links to the requested application, gateway, and governance documentation without broken internal routes

### Requirement: Documentation reflects executable commands and boundaries

The documentation SHALL describe commands and paths that match the repository's current manifests, including gateway package and root tasks, and SHALL distinguish local build/test evidence from Cloudflare deployment, gateway deployment, remote synchronization, database, and production runtime evidence.

#### Scenario: A command guide is followed
- **WHEN** an engineer follows a documented setup, development, or validation command
- **THEN** the command maps to an available workspace or package task and its stated local or remote side effects are accurate

#### Scenario: Gateway hosting boundaries are read
- **WHEN** a reader follows the gateway documentation
- **THEN** they can distinguish AI traffic routing through the gateway from hosting or serving the web app, backoffice, backend API, CLI, or documentation site
