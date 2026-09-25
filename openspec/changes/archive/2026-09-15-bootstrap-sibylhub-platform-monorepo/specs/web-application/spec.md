## Purpose

Provide the SibylHub public web surface as an Astro 5 and React 19 application that runs on Cloudflare, preserves server-first rendering, and exposes explicit data-binding and deployment contracts.

## ADDED Requirements

### Requirement: The web application renders a baseline route on the target runtime

The web application SHALL provide a successful baseline public route in local development, production build output, and the declared Cloudflare runtime mode. The route SHALL render without requiring a live backoffice or backend during the baseline check.

#### Scenario: The baseline route is built and previewed

- **WHEN** an engineer runs the documented web build and local preview commands
- **THEN** the generated artifact contains the baseline route and the preview returns a successful response without unresolved Astro, React, or runtime configuration errors

#### Scenario: The baseline route runs in Cloudflare mode

- **WHEN** the application is started using the declared Cloudflare-compatible runtime configuration
- **THEN** the route responds through the selected static, server-rendered, or hybrid mode without targeting an undeclared platform

### Requirement: Rendering and hydration are proportionate to interaction

The web application SHALL keep non-interactive content in Astro-rendered output and SHALL hydrate React 19 islands only for browser interaction. Interactive controls SHALL expose accessible names and state through the selected HeroUI v3 interaction model and SHALL not depend on a legacy provider or v2-only API.

#### Scenario: A non-interactive page section is viewed

- **WHEN** a visitor loads a section with no browser interaction
- **THEN** its content is present in the delivered HTML without a React runtime island being required solely for display

#### Scenario: An interactive control is operated

- **WHEN** a visitor uses keyboard or pointer input on a scaffolded control
- **THEN** the control exposes an accessible name and state and responds through supported semantic variants and accessible event handling

### Requirement: Cloudflare bindings and deployment targets are explicit

The application SHALL declare named contracts for the D1 database binding `DB`, the R2 AST storage binding `AST_STORAGE`, and the Vectorize index binding `VECTORIZE_INDEX`. The documented Wrangler workflow SHALL distinguish local validation, preview, and remote deployment, SHALL require an explicit target for remote operations, and SHALL keep credentials outside tracked files.

#### Scenario: Binding configuration is validated locally

- **WHEN** an engineer runs the configuration/build validation without production credentials
- **THEN** the declared binding names, output directory, and target shape are checked locally and no remote resource is created, changed, or deleted

#### Scenario: A deployment target is missing

- **WHEN** a remote deployment command is invoked without its required explicit target configuration
- **THEN** the command fails before contacting Cloudflare and reports the missing configuration without selecting a default account or project

### Requirement: Web quality checks are independently runnable

The web application SHALL expose development, production build, preview, deployment/configuration validation, type checking, linting, formatting, tests, and coverage commands. Baseline checks SHALL not require production credentials, a live backend, or a live Cloudflare resource.

#### Scenario: A web change is validated locally

- **WHEN** an engineer runs the documented web validation commands
- **THEN** rendering, TypeScript, lint, test, and build failures are reported as separate web gates and the checks do not perform remote mutation
