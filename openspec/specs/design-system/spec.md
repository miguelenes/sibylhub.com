# design-system Specification

## Purpose

Provide a reusable Oracle & Engine visual and interaction contract for SibylHub surfaces, with stable semantic tokens, Tailwind integration, and accessible telemetry-oriented React primitives that can be consumed without importing an application shell.

## Requirements

### Requirement: The design-system package exposes stable public entrypoints

The workspace SHALL provide a package named `@sibylhub/design-system` at version `0.1.0` with a component entrypoint, a token stylesheet entrypoint, and a Tailwind integration entrypoint. The package SHALL be consumable by React 19 applications and SHALL expose built ESM modules with TypeScript declarations, declaration maps, and source maps whose public subpaths mirror the source entrypoints `src/index.ts`, `src/styles/globals.css`, and `src/tailwind-preset.ts`. Its peer dependency contract SHALL include React 19, React DOM 19, Tailwind CSS 3.4 or 4, `lucide-react`, and the Radix Progress primitive used by the gauge.

#### Scenario: A workspace consumer imports the package

- **WHEN** a consumer imports `@sibylhub/design-system`, `@sibylhub/design-system/tokens`, or `@sibylhub/design-system/tailwind`
- **THEN** the corresponding component, CSS token, or Tailwind integration entrypoint resolves without importing application-only code

#### Scenario: The package is built for distribution

- **WHEN** the package build completes
- **THEN** each JavaScript entrypoint has an ESM artifact and TypeScript declaration metadata, and the CSS token entrypoint remains available to CSS-aware consumers

### Requirement: The token contract is semantic, HSL-based, and shared across consumers

The package SHALL expose semantic CSS custom properties using space-separated HSL values compatible with shadcn/ui conventions. The canonical tokens SHALL include Deep Obsidian `hsl(230 24% 5%)`, elevated surface `hsl(222 24% 7%)`, subtle border `hsl(220 13% 18%)`, Electric Cyan / Oracle Blue `hsl(199 89% 48%)`, Telemetry Violet `hsl(265 89% 66%)`, the five specified agent-state values, and the five specified context-partition values. Quota semantics SHALL distinguish nominal below 70%, warning from 70% through below 85%, critical from 85% through 95%, and overflow above 95%, with named tokens for each state.

#### Scenario: A CSS consumer loads the token entrypoint

- **WHEN** a CSS consumer imports the package token entrypoint
- **THEN** the semantic surface, accent, agent-state, context-partition, and quota custom properties are available without requiring a JavaScript runtime

#### Scenario: A usage value crosses a quota boundary

- **WHEN** a component computes a usage percentage below 70%, at least 70% and below 85%, at least 85% and at most 95%, or above 95%
- **THEN** it selects the nominal, warning, critical, or overflow semantic state respectively and communicates that state through more than color alone

### Requirement: Tailwind integration maps semantic tokens and preserves compact telemetry density

The package SHALL provide a Tailwind integration that maps the semantic token contract to utility classes for surfaces, text, borders, accents, agent states, context partitions, and quota states. It SHALL expose `2xs` as `0.125rem` and `xs` as `0.25rem`, define `font-sans` with Geist and Inter fallbacks, define `font-mono` with Geist Mono and JetBrains Mono fallbacks, and provide `pulse-slow`, `radar-sweep`, and `gauge-fill` animations. The shared token stylesheet SHALL also provide the CSS-first adapter needed by Tailwind 4 consumers so the Filament theme does not require a legacy Tailwind configuration file.

#### Scenario: A Tailwind consumer uses semantic utilities

- **WHEN** a consumer uses semantic background, foreground, border, agent-state, partition, quota, density, typography, or animation utilities
- **THEN** the generated styles resolve to the shared design-system token values and do not require duplicated color literals in the consuming application

#### Scenario: Reduced motion is enabled

- **WHEN** the user prefers reduced motion
- **THEN** radar, pulse, and gauge animations are suppressed or reduced while the component remains legible and conveys the same state

### Requirement: Telemetry primitives expose accessible operational state

The package SHALL export `ContextWindowGauge`, `AgentStatusBadge`, `TelemetryCard`, and `StackInvariantTag` as composable React 19 components. They SHALL use semantic HTML, visible keyboard focus for any interactive behavior, accessible names and status text, and the shared token contract rather than application-specific palette values.

#### Scenario: The component exports are imported

- **WHEN** a React 19 consumer imports the four named primitives from the package root
- **THEN** each export is available without a provider, router, global store, or application-specific context

#### Scenario: A primitive is rendered in a narrow layout

- **WHEN** a consumer renders a primitive in a constrained width
- **THEN** labels and status information remain readable, the layout does not overflow horizontally, and the component preserves its semantic meaning

### Requirement: ContextWindowGauge represents the five context partitions and thresholds

`ContextWindowGauge` SHALL render token usage as five distinguishable segments for rules, memories, AST, active context, and tools. It SHALL use the Radix Progress primitive for aggregate progress semantics, expose the aggregate usage and limit through an accessible progress representation, show partition labels or an equivalent accessible description, change its warning treatment at the quota thresholds, and provide the RTK savings badge with `-74.2%` as the default displayed savings value unless the consumer supplies another explicitly formatted value. Lucide icons SHALL be used for component iconography rather than ad hoc inline SVG paths.

#### Scenario: A normal context window is rendered

- **WHEN** the aggregate usage is below 70%
- **THEN** all five partition segments are visible, the gauge reports its current usage and limit, and the nominal state is communicated in text or an accessible status label

#### Scenario: A context window approaches or exceeds its limit

- **WHEN** aggregate usage reaches a warning, critical, or overflow threshold
- **THEN** the gauge changes its semantic warning treatment, preserves all partition information, and exposes the threshold state to assistive technology

### Requirement: AgentStatusBadge represents all supported agent states

`AgentStatusBadge` SHALL support running, idle, failed, blocked, and awaiting states with the corresponding shared state tokens, a readable status label, and a radar-pulse indicator whose motion reflects the state without being the sole state signal. Failed and blocked states SHALL remain visually distinguishable when motion is disabled.

#### Scenario: An agent transitions between operational states

- **WHEN** the consumer changes the badge from one supported state to another
- **THEN** the label, semantic tone, indicator treatment, and accessible status update together without requiring a remount

### Requirement: TelemetryCard and StackInvariantTag communicate dense metrics and compliance

`TelemetryCard` SHALL present a high-density surface with a monospace telemetry header and structured key-value metrics. `StackInvariantTag` SHALL present an invariant violation or compliance result with explicit text and a semantic tone that distinguishes compliant, warning, and violating states without relying on color alone.

#### Scenario: A telemetry card has no metrics

- **WHEN** a consumer renders the card with an empty metric collection
- **THEN** the header remains identifiable and the card provides a deliberate empty-state treatment rather than rendering an ambiguous blank surface

#### Scenario: An invariant result is displayed

- **WHEN** the consumer renders a compliance check or invariant violation
- **THEN** the tag exposes the result text and state to both visual and assistive-technology users

### Requirement: Package validation is local and does not require production services

The package SHALL expose local build, formatting or lint, type-check, and test commands compatible with the repository orchestration. Its validation SHALL not require Cloudflare, a database, a remote registry, a production API, or secret environment values.

#### Scenario: A fresh local workspace validates the package

- **WHEN** an engineer runs the package's documented validation commands with workspace dependencies installed
- **THEN** failures identify the owning package and task, and successful checks provide evidence only for local package correctness
