## Why

SibylHub currently has no shared visual contract across its React-facing packages and its Filament 5 backoffice. The web application has a HeroUI v3 layer, while the backoffice still uses Filament's default compiled styles and a local Tailwind entrypoint, so semantic colors, density, typography, and operational-state language can drift between surfaces.

The platform needs one additive, reusable `@sibylhub/design-system` package that establishes the Oracle & Engine design language and gives the Filament 5 admin panel a supported custom theme consumer. This change creates that foundation without migrating existing web screens.

## What Changes

- Add `@sibylhub/design-system` as a compiled shared package under `packages/design-system`.
- Define the canonical HSL semantic token set for Obsidian surfaces, telemetry accents, agent states, context partitions, and quota thresholds.
- Export a Tailwind-compatible semantic preset, compact spacing scale, typography families, and telemetry animations.
- Add the requested React 19 telemetry primitives: `ContextWindowGauge`, `AgentStatusBadge`, `TelemetryCard`, and `StackInvariantTag`, using Radix Progress for accessible gauge semantics and Lucide for iconography.
- Add package build and type-check configuration for ESM output, declaration files, declaration maps, and source maps.
- Add a root `tsconfig.base.json` compatibility bridge that extends the existing shared TypeScript base so the new package can follow the requested root-based configuration contract without creating a second source of compiler settings.
- Add a Filament 5 custom admin theme at `apps/backoffice/resources/css/filament/admin/theme.css` that consumes the shared design-system tokens and Tailwind contract while retaining Filament's own component stylesheet.
- Register the custom theme in the backoffice Vite input and the Filament `AdminPanelProvider` through `->viteTheme(...)`.
- Add explicit Tailwind source scanning for the backoffice's Filament resources, Blade views, and application components so custom utility classes are emitted reliably.
- Make the backoffice consume the workspace design-system package through its native pnpm dependency boundary; Composer remains authoritative for PHP and Filament dependencies.
- Extend workspace documentation and orchestration metadata so the new shared package has discoverable ownership, build output, and validation commands.
- Keep `apps/web`'s existing HeroUI v3 integration unchanged in this initial change; later adoption can be scoped separately.

## Capabilities

### New Capabilities

- `design-system`: Shared Oracle & Engine tokens, Tailwind contract, React telemetry primitives, package exports, and build/type-check behavior.
- `filament-theme`: A Filament 5 custom admin theme that consumes the shared token and Tailwind contract through the backoffice's Vite pipeline.

### Modified Capabilities

- `monorepo-orchestration`: Register `packages/design-system` as a governed shared package with its owning toolchain, build artifact, and task-graph participation.

## Impact

- New package files under `packages/design-system` and a new workspace dependency path for the backoffice.
- Backoffice Vite, CSS theme, Filament panel provider, and package manifest changes; the PHP Composer dependency graph remains unchanged.
- Root workspace documentation, configuration validation, and task orchestration may need updates so package discovery and finish gates include the new package.
- New Lucide, Radix Progress, and build-tool JavaScript dependencies may be required for the package; the Radix dependency is justified by the gauge's accessible progress semantics rather than being added as a generic wrapper layer.
- The change is local and additive. It does not deploy Cloudflare assets, publish a registry, alter production authorization, or migrate existing application screens.
