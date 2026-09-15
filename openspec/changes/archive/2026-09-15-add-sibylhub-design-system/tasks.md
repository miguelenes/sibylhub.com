## 1. Workspace and package foundation

- [x] 1.1 Add the root `tsconfig.base.json` bridge extending `packages/typescript-config/base.json`, add `packages/design-system/package.json`, and create the package source/config directories; verify the bridge contains no independent compiler policy and the manifest has the requested name, version, exports, and peer dependency contract.
- [x] 1.2 Add the design-system pnpm scripts and development dependencies for ESM bundling, declaration-map generation, React typings, Radix Progress, Lucide, and local testing; verify `pnpm check:config` recognizes the package and `pnpm install --lockfile-only` produces a workspace-consistent lockfile update without Composer changes.
- [x] 1.3 Add `packages/design-system/tsconfig.json`, `tsup.config.ts`, and the CSS-asset copy/build support; verify the package build emits ESM JavaScript, declaration files, declaration maps, source maps, and the token CSS asset under the paths used by package exports.

## 2. Canonical tokens and Tailwind contract

- [x] 2.1 Implement `packages/design-system/src/styles/globals.css` with the strict space-separated HSL token contract, semantic aliases, five agent states, five context partitions, quota states and thresholds, Tailwind 4 `@theme inline` mappings, telemetry keyframes, and reduced-motion rules; verify focused CSS assertions cover every requested value and reject comma-separated color syntax.
- [x] 2.2 Implement `packages/design-system/src/tailwind-preset.ts` with semantic colors, compact `2xs`/`xs` spacing, Geist/Inter and Geist Mono/JetBrains Mono stacks, and the `pulse-slow`, `radar-sweep`, and `gauge-fill` animations; verify the exported preset resolves the expected values in a Tailwind 3.4-compatible fixture.
- [x] 2.3 Add token and preset contract tests that load the public package subpaths rather than relative source files; verify the tests demonstrate that consumers receive one canonical token value and that reduced-motion styles are present.

## 3. React telemetry primitives

- [x] 3.1 Add shared public types and class-name composition helpers needed by the four primitives without introducing an application provider, router, or global store; verify strict TypeScript compilation succeeds with React 19 types.
- [x] 3.2 Implement `ContextWindowGauge.tsx` with five named partition segments, Radix Progress aggregate semantics, quota threshold transitions, accessible labels/value/max information, Lucide iconography, and the default `-74.2%` RTK savings badge; verify component tests cover nominal, warning, critical, overflow, empty, and over-limit data plus reduced motion.
- [x] 3.3 Implement `AgentStatusBadge.tsx` with running, idle, failed, blocked, and awaiting states, radar-pulse treatment, readable text, and non-color state cues; verify tests cover state transitions, accessible status output, and motion-disabled rendering.
- [x] 3.4 Implement `TelemetryCard.tsx` and `StackInvariantTag.tsx` with dense monospace metric presentation, deliberate empty metrics behavior, compliance/violation states, Lucide icons, and accessible text; verify tests cover empty, compliant, warning, and violating cases at narrow-layout-friendly markup.
- [x] 3.5 Implement `packages/design-system/src/index.ts` with the four public component exports and supporting public types; verify package-root imports resolve through the declared export map and no placeholder or `// TODO` comments remain in the package source.

## 4. Filament 5 custom theme integration

- [x] 4.1 Add the workspace dependency on `@sibylhub/design-system` to `apps/backoffice/package.json` without changing Composer ownership; verify the dependency resolves through pnpm and does not add a duplicate PHP or Tailwind dependency graph.
- [x] 4.2 Create `apps/backoffice/resources/css/filament/admin/theme.css` by retaining Filament's supported vendor theme baseline, importing the shared token entrypoint, and adding explicit `@source` directives for the actual Filament, Blade, Livewire/application, and resource JavaScript directories; verify the theme contains no duplicated Oracle & Engine palette literals.
- [x] 4.3 Add the custom theme path to `apps/backoffice/vite.config.js` and register it with `->viteTheme('resources/css/filament/admin/theme.css')` in `AdminPanelProvider`; align the panel primary treatment with the chosen built-in Filament Cyan palette and verify route/provider configuration remains valid with `php artisan route:list --except-vendor`.
- [x] 4.4 Build the backoffice assets and inspect the emitted theme for shared token values, Filament component styles, generated semantic utilities, dark-mode selectors, focus styles, and reduced-motion rules; verify Vite fails clearly if the workspace design-system package cannot be resolved.

## 5. Workspace governance and documentation

- [x] 5.1 Update root workspace documentation and any required configuration validation paths to list `packages/design-system`, its pnpm/TypeScript owner, local commands, build artifact, and additive relationship to the HeroUI-based web application; verify the documentation and `pnpm check:config` agree on the package path.
- [x] 5.2 Confirm Turbo task inputs and dependency ordering include the new package through its standard scripts, while development servers and side-effecting tasks remain uncached; verify with the repository's task graph/config inspection rather than relying on a successful single package build.

## 6. Verification and finish gates

- [x] 6.1 Run the focused design-system build, typecheck, lint/format, component tests, coverage, and package export checks; record each result separately and verify no check requires a remote service or secret.
- [x] 6.2 Run the backoffice local checks required by `apps/backoffice/AGENTS.md`, including asset build, `php artisan about`, `php artisan route:list --except-vendor`, `php artisan test`, and `vendor/bin/pint --test`; verify panel/theme failures are distinguished from unrelated production or publication evidence.
- [x] 6.3 Run the repository finish gates `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build`; verify the final worktree and OpenSpec change contain no generated secrets, placeholders, or unrelated edits, and report remote deployment/publication as unperformed unless separately authorized.
