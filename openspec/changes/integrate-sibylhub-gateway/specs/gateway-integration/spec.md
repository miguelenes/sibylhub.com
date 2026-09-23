# Spec Delta

## Purpose

Defines the identity and application boundary for SibylHub's AI traffic gateway, including its compatibility and provenance requirements as it becomes part of the monorepo.

## ADDED Requirements

### Requirement: The SibylHub Gateway is an independently operated AI traffic application

The SibylHub Gateway SHALL serve as a distinct application for routing and governing AI-provider, MCP, and A2A traffic. It SHALL NOT be represented as the host runtime for SibylHub's web application, backoffice, backend API, CLI, or documentation site.

#### Scenario: A contributor identifies the gateway's role
- **WHEN** a contributor reads the gateway overview or the platform architecture
- **THEN** they can identify it as SibylHub's AI traffic gateway and distinguish it from the independently hosted SibylHub applications

#### Scenario: An application uses the gateway
- **WHEN** a SibylHub application sends supported AI traffic through the gateway
- **THEN** the gateway routes that traffic to its configured provider or agent integration without implying that the application itself runs inside the gateway

### Requirement: First-party gateway surfaces use SibylHub identity with accurate provenance

First-party product, command, configuration, container, admin-reference, observability, and brand-asset surfaces SHALL identify the product as SibylHub Gateway. References to upstream projects, provider brands, standards, and required copyright or license notices SHALL remain accurate and SHALL NOT be rewritten to imply SibylHub authorship. Distribution claims SHALL match verified license evidence.

#### Scenario: A first-party product surface is presented
- **WHEN** an operator views a gateway-owned overview, help/version output, admin API description, configuration example, or container metadata
- **THEN** the surface identifies the product as SibylHub Gateway and does not present AISIX or API7 as its current product identity

#### Scenario: An upstream reference or license notice is retained
- **WHEN** a branded source, integration, or distribution notice refers to upstream work or licensing
- **THEN** the reference preserves the correct upstream identity and verified attribution instead of claiming SibylHub authored that work

### Requirement: Rebranding preserves gateway protocol contracts and documents identifier migration

Branding changes SHALL preserve the existing OpenAI-compatible, Anthropic, MCP, and A2A protocol routes and payload contracts. Every changed gateway-owned identifier that is externally consumed, including configuration keys, environment variables, executable names, custom headers, and metric names, SHALL have a documented compatibility alias or an explicit migration instruction. Provider identities and third-party protocol names SHALL NOT be renamed as SibylHub-owned identifiers.

#### Scenario: A standard protocol client continues to use the gateway
- **WHEN** a client sends a request using a supported OpenAI-compatible, Anthropic, MCP, or A2A contract
- **THEN** the request route and protocol payload contract remain compatible after the branding change

#### Scenario: An operator encounters a renamed gateway identifier
- **WHEN** an operator upgrades a configuration, command, custom header, or metric reference affected by the rebrand
- **THEN** the migration guidance identifies the old and new identifiers and states whether the old value remains accepted as an alias

#### Scenario: A third-party identity appears in gateway materials
- **WHEN** a provider, protocol, or upstream project is named in gateway-owned source or documentation
- **THEN** its established third-party name is preserved and is not presented as a SibylHub product namespace
