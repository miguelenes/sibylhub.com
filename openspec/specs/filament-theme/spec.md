# filament-theme Specification

## Purpose

Provide the Filament 5 administration panel with a supported custom Tailwind theme that consumes the shared SibylHub design-system contract, preserves Filament panel behavior, and keeps theme compilation inside the backoffice's local Vite workflow.

## Requirements

### Requirement: The backoffice registers a compiled custom Filament theme

The backoffice SHALL provide a custom admin theme stylesheet for the `admin` panel, include it in the Laravel Vite input, and register the same source path with the Filament panel provider through the supported Filament 5 theme mechanism. The panel SHALL continue to resolve its existing route and authentication boundary when the custom theme is unavailable or being rebuilt; a stale or failed asset build SHALL produce an actionable local build error rather than silently claiming a current theme.

#### Scenario: The backoffice assets are built

- **WHEN** an engineer runs the documented backoffice asset build
- **THEN** Vite emits the custom admin theme and the Filament panel provider points to that compiled theme entry without requiring a production service

#### Scenario: The admin panel route is requested after a successful build

- **WHEN** an authenticated or unauthenticated user requests the configured admin panel route
- **THEN** Filament returns the existing panel shell or an explicit authentication response and loads the compiled custom theme without a missing-route or bootstrap error

### Requirement: The Filament theme consumes the design-system contract without duplicating its palette

The custom theme SHALL import or otherwise consume the canonical `@sibylhub/design-system` token stylesheet, including the CSS-first Tailwind 4 semantic mappings it exposes. The backoffice build SHALL use those shared CSS mappings directly and SHALL NOT require the package's JavaScript `tailwind-preset.ts`; that preset remains available for Tailwind 3.4-compatible consumers. The theme SHALL retain Filament's supported base/component stylesheet and SHALL not re-declare equivalent Deep Obsidian, telemetry, agent-state, context-partition, or quota color values as independent literals. Its generated utility classes SHALL resolve through the shared semantic contract.

#### Scenario: A shared token changes

- **WHEN** a canonical design-system token is updated and the backoffice theme is rebuilt
- **THEN** the corresponding Filament theme output reflects the updated semantic value without requiring a second palette edit in the backoffice theme

#### Scenario: A backoffice view uses shared utilities

- **WHEN** a Filament resource, Blade view, or application component uses a shared semantic utility
- **THEN** Tailwind emits the utility because the custom theme scans the relevant backoffice source directories, and the rendered style uses the shared token

### Requirement: Theme source scanning covers the backoffice code that owns UI markup

The custom theme SHALL explicitly scan the Filament resources, Filament pages and widgets, relevant Blade views, Livewire or application component directories when present, and any other tracked backoffice source directory that emits Tailwind class names. The source list SHALL be reviewable in the theme entrypoint and SHALL not rely on the default Filament stylesheet to emit arbitrary application utilities.

#### Scenario: A new resource adds a utility class

- **WHEN** a developer adds a valid Tailwind utility to a tracked Filament resource or backoffice view and rebuilds assets
- **THEN** the utility is present in the generated theme without adding a separate global stylesheet workaround

### Requirement: Filament theme behavior remains accessible and operationally stable

The custom theme SHALL preserve Filament's semantic controls, focus visibility, dark-mode behavior, readable contrast, responsive layout, and reduced-motion behavior. The theme SHALL not hide scrollbars, disable keyboard navigation, or use animation as the only indicator of an agent, quota, or compliance state.

#### Scenario: The panel is used with keyboard navigation

- **WHEN** a user navigates the admin panel without a pointer
- **THEN** controls retain visible focus and the custom theme does not remove Filament's accessible interaction behavior

#### Scenario: Reduced motion is enabled in the panel

- **WHEN** the operating system requests reduced motion
- **THEN** shared telemetry animation styles are reduced or disabled while status and compliance information remains available as text and semantic state

### Requirement: Backoffice theme validation stays within native workspace boundaries

The backoffice SHALL use pnpm and Vite for the JavaScript/CSS theme dependency and asset workflow, Composer for Laravel and Filament dependencies, and local PHP/application checks for panel validation. Theme validation SHALL not publish assets remotely, mutate production state, or require secrets.

#### Scenario: The backoffice theme is validated locally

- **WHEN** an engineer runs the documented backoffice build, route inspection, formatting, and application test commands
- **THEN** the results identify theme compilation and panel/runtime failures separately from unrelated remote deployment or publication evidence
