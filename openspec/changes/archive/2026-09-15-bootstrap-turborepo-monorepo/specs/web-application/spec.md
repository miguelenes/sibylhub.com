## Purpose

Provide the public web surface as a fast, static-first Astro application with React 19 islands, accessible HeroUI v3 UI foundations, and a Cloudflare-compatible deployment artifact.

## ADDED Requirements

### Requirement: The web application renders a baseline public page

The web application SHALL render a successful baseline route in a production build, SHALL use TypeScript, and SHALL keep non-interactive page content server-rendered or static while hydrating only components that require browser interaction.

#### Scenario: The public route is built
- **WHEN** the web build command completes successfully
- **THEN** the generated output contains a renderable baseline public route and no unresolved Astro, TypeScript, or React integration errors

#### Scenario: A non-interactive section is viewed
- **WHEN** a visitor loads a page section that has no browser interaction
- **THEN** that section is delivered as HTML without requiring a React runtime island solely to display it

### Requirement: Interactive web controls use the selected accessible UI foundation

Interactive React controls SHALL use React 19-compatible components and HeroUI v3 semantics, SHALL use semantic variants and accessible interaction handlers, and SHALL not require a legacy HeroUI provider or v2-only component API.

#### Scenario: An interactive control is used
- **WHEN** a visitor operates a scaffolded interactive control with keyboard or pointer input
- **THEN** the control exposes an accessible name and state and responds through the supported HeroUI v3 interaction model

### Requirement: Cloudflare deployment configuration is explicit

The web application SHALL provide a documented Wrangler workflow whose build output and deployment target are explicit, SHALL keep deployment credentials outside the repository, and SHALL fail validation when required deployment configuration is absent rather than silently targeting an unintended resource.

#### Scenario: A local deployment configuration is inspected
- **WHEN** an engineer runs the documented configuration/build check without production credentials
- **THEN** the check validates the declared Cloudflare target shape and build artifact while making no remote mutation

### Requirement: Web quality checks are available locally

The web application SHALL expose local scripts for development, build, type checking, linting, and tests, with focused tests covering the baseline route or its rendering contract.

#### Scenario: A web change is validated
- **WHEN** an engineer runs the web package validation scripts
- **THEN** type, lint, test, and production-build failures are reported independently and the checks do not require a live backend or production service
