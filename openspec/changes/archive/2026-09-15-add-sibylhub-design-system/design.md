## Context

See `proposal.md` for the motivation and scope. The current workspace has a compiled-package pattern in `packages/schemas`, a canonical shared TypeScript base in `packages/typescript-config/base.json`, and no root `tsconfig.base.json`. The web app uses Tailwind 4 CSS-first integration and HeroUI v3. The backoffice uses Filament 5.8.1, Laravel Vite, and `@tailwindcss/vite`, but its Filament panel has no custom theme entry yet.

The Filament 5 documentation requires a panel-specific `resources/css/filament/{panel}/theme.css`, a Vite input entry, a `->viteTheme(...)` panel registration, and explicit Tailwind `@source` directives for application-owned markup. Filament's vendor theme imports its own Tailwind baseline and component styles; the SibylHub theme must preserve that baseline while adding the shared contract.

## Goals / Non-Goals

**Goals:**

- Establish one semantic Oracle & Engine token source that works in React, Tailwind 3.4-compatible consumers, Tailwind 4 CSS-first consumers, and the Filament 5 admin theme.
- Provide accessible, low-level telemetry primitives with a justified Radix dependency for progress semantics and Lucide iconography.
- Keep package, pnpm, Composer, Vite, Filament, and Turbo ownership explicit and locally verifiable.
- Make the backoffice theme update when shared tokens change, without copying the palette into PHP or a second CSS file.
- Preserve Filament's own component styles, panel route, authentication boundary, keyboard behavior, dark-mode support, and reduced-motion behavior.

**Non-Goals:**

- Migrating existing `apps/web` screens from HeroUI v3.
- Replacing HeroUI, introducing a global React provider, or creating an application-wide state store.
- Adding a second Tailwind configuration file to the backoffice.
- Publishing a package, deploying assets, changing production authorization, or connecting local validation to remote services.
- Building a complete application component catalog beyond the four requested telemetry primitives.

## Decisions

### 1. Keep CSS tokens canonical and provide two Tailwind adapters

`packages/design-system/src/styles/globals.css` will own the semantic values. It will use shadcn-compatible channel triples with space-separated HSL components, consumed through `hsl(var(--token))`, so the resulting values remain equivalent to the requested `hsl(230 24% 5%)`-style syntax without comma-separated legacy notation. The file will define semantic aliases, quota thresholds, Tailwind 4 `@theme inline` mappings, keyframes, and reduced-motion rules.

`src/tailwind-preset.ts` will map the same variables for Tailwind 3.4-compatible consumers. The Filament theme will import the CSS token entrypoint directly and use its CSS-first mappings; it will not depend on a legacy `tailwind.config.*` file. This avoids duplicating the palette while respecting the current Tailwind 4 integration model.

### 2. Use a standard compiled-package boundary with source-mirrored subpaths

The package will author components in `src/index.ts`, tokens in `src/styles/globals.css`, and the preset in `src/tailwind-preset.ts`. Its package exports will preserve the requested `.`/`./tokens`/`./tailwind` subpath names while resolving workspace and distributable consumers to built artifacts under `dist`. TypeScript declaration generation will run through the package's compiler configuration so declaration maps are retained; `tsup` will produce ESM JavaScript bundles, and a small build step will copy the CSS token asset into the matching `dist` location.

This follows the existing `packages/schemas` dist-based package convention and prevents consumers from attempting to execute TypeScript source directly. The source entrypoint paths remain the authoring contract and are covered by package export/build tests.

### 3. Add a root TypeScript compatibility bridge instead of a second compiler policy

The repository will add a minimal root `tsconfig.base.json` that extends `packages/typescript-config/base.json`. `packages/design-system/tsconfig.json` will extend that root bridge and add only package-specific emit settings such as `rootDir`, `outDir`, declarations, declaration maps, source maps, and the no-emit override needed for the build pipeline.

This satisfies the requested root-based extension while retaining the existing shared config as the only compiler-policy source. The bridge will not redefine module resolution, strictness, target, or library settings.

### 4. Use Radix Progress only where it owns a real accessibility behavior

`ContextWindowGauge` will use `@radix-ui/react-progress` as a peer dependency for the aggregate progress role, value, and maximum semantics. The five visual partition segments will be children of the progress root, with widths derived from token counts and the shared quota state. `AgentStatusBadge`, `TelemetryCard`, and `StackInvariantTag` will use semantic HTML and do not need Radix wrappers.

`lucide-react` will provide the small state and compliance icons. No inline SVG icon library, HeroUI provider, router, or global context will be introduced. This keeps the dependency surface proportional to the requested behaviors.

### 5. Keep primitive APIs data-first and application-independent

The components will accept serializable props rather than reading a global store. The gauge will accept five named partition values and a context limit, derive aggregate usage and quota state, and allow an explicitly formatted RTK savings label with `-74.2%` as the default. The status badge will accept the five finite operational states. The card will accept a title and ordered key-value metrics plus children, and the invariant tag will accept a compliance or violation state and text.

All primitives will expose text equivalents for state, use stable semantic labels, and include class-name composition without imposing an application CSS reset. Motion is decorative and is disabled or reduced under `prefers-reduced-motion`.

### 6. Make the Filament theme a consumer, not a fork of Filament CSS

`apps/backoffice/resources/css/filament/admin/theme.css` will import Filament's vendor theme baseline, import `@sibylhub/design-system/tokens`, and declare explicit `@source` paths for `app/Filament`, resource views, components, Livewire/application-owned directories that exist, and the backoffice resource JavaScript. The theme will use semantic utilities and token aliases instead of repeating raw palette values.

`apps/backoffice/vite.config.js` will add the theme entry alongside the existing app entries. `AdminPanelProvider` will register the same path with `->viteTheme('resources/css/filament/admin/theme.css')`. The provider's primary color will move from the existing Amber preset to Filament's built-in Cyan palette so the panel's primary treatment is directionally aligned with Oracle Blue without embedding a PHP copy of the CSS token palette; exact custom application accents remain CSS-token based.

The theme will preserve Filament's normal dark-mode switching and focus behavior. The Oracle & Engine dark surface is the default visual direction, but the implementation will not force a permanent dark-only mode unless the existing panel contract requires it.

### 7. Keep native dependency and task ownership explicit

`@sibylhub/design-system` will be a pnpm workspace package with build, typecheck, lint/format, test, coverage, and clean scripts consistent with the repository task graph. The backoffice will consume it through a workspace JavaScript dependency used by Vite; Composer remains the owner of Laravel and Filament dependencies. Turbo's existing dependency-aware tasks will pick up the design-system build through the package scripts, while documentation and configuration checks will list the new root explicitly.

The package will use local fixtures and component tests only. Backoffice validation will use the existing local Artisan, Pint, PHP test, route, and Vite checks; no test or build task will publish artifacts or connect to production services.

## Risks / Trade-offs

- [Tailwind 3.4 and 4 have different integration models] → Keep semantic CSS tokens canonical, test the preset separately, and make the Filament theme use the CSS-first adapter rather than a legacy config file.
- [Dist exports can drift from source entrypoints] → Build and test all three public subpaths, copy the CSS asset as part of the package build, and verify package exports from a clean consumer fixture.
- [A Radix peer can be missing from a consumer] → Declare the exact Radix Progress peer, use it only in the gauge, and make package checks fail clearly when the peer contract is incomplete.
- [Filament vendor CSS import order can affect Tailwind layers] → Import the supported Filament theme first, then the shared token contract, keep all `@source` directives in the custom theme, and verify the emitted CSS through the backoffice Vite build.
- [Changing the panel primary color can alter existing screenshots or user expectations] → Use Filament's built-in Cyan palette rather than a duplicated custom PHP palette, preserve the existing panel route/auth behavior, and review the rendered panel states during verification.
- [The root TypeScript bridge could become a second policy file] → Keep it as a one-line extension of `packages/typescript-config/base.json` and add no independent compiler options beyond what the package requires.
- [The initial package can be mistaken for full application adoption] → Leave `apps/web` unchanged, document the additive boundary, and report package/backoffice verification separately from future consumer migrations.

## Migration Plan

1. Add the root TypeScript bridge, design-system package, direct peer/dev dependencies, build scripts, and package tests.
2. Add the workspace dependency and Filament theme entry, then register the Vite input and panel theme path.
3. Build the design-system package before the backoffice theme and run the focused package and backoffice checks.
4. Run the repository finish gates required by the project once all implementation files are complete; distinguish local success from any unavailable remote evidence.
5. Roll back by removing the backoffice workspace dependency, theme input, `->viteTheme(...)` registration, and theme file. The shared package and root bridge can then be removed independently if no other consumer has adopted them.

