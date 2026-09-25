## Context

The existing `apps/docs` package is a Docusaurus v3 TypeScript site already
connected to the workspace task graph. It currently has a single flat sidebar,
five short Markdown pages, a minimal cyan-only stylesheet, and a shallow link
validator. The repository's shared schemas, CLI, Rust service contracts, and
design-system tokens are the authoritative sources for the expanded content.

The docs build must remain a deterministic static operation. It cannot require
the backend, Laravel database, Cloudflare resources, a registry service,
credentials, or remote synchronization. The current Docusaurus package already
uses `@docusaurus/module-type-aliases` and the repository-supported
`@docusaurus/tsconfig` through the shared TypeScript preset; no replacement
dependency will be introduced without a concrete build or type-checking gap.

## Goals / Non-Goals

**Goals:**

- Make the current docs app the official, navigable technical reference for
  the monorepo, `.agent/` metadata, context governance, registry contracts,
  audited-tool boundaries, and CLI behavior.
- Keep every documented command, path, schema field, endpoint, and runtime
  boundary traceable to checked-in source or an explicitly marked unavailable
  contract.
- Apply the design-system palette and typography as static CSS while preserving
  Docusaurus accessibility and dark-first behavior.
- Produce a self-contained `apps/docs/build/` artifact through the existing
  Turborepo package bridge.

**Non-Goals:**

- No backend, registry, database, Cloudflare, R2, DNS, or synchronization
  implementation.
- No execution, installation, sandboxing, or automatic publication of Rosie,
  FastMCP, Context7, or other submitted tools.
- No live registry fetch during a docs build and no generated table of package
  policy values from a remote source.
- No modification to the shared schema, CLI, Rust, backoffice, or web runtime
  contracts.

## Decisions

### Use the existing docs package and package bridge

Keep `apps/docs` as the owning package, retain its existing private `docs`
package name and Docusaurus scripts, and use the root workspace discovery and
Turborepo dependency graph. Package-level checks can be run through the
existing scripts and the static build can be checked with
`pnpm turbo run build --filter=docs` or the equivalent root build task.

The alternative of creating a second docs app or changing the root workspace
layout would duplicate the already-working build boundary and is rejected.

### Configure Docusaurus directly for the publication contract

Update `docusaurus.config.ts` with the official title, tagline, URL, strict
broken-link settings, dark-first color mode, and Prism languages. Keep the
classic preset and disabled blog because the requested result is a technical
reference rather than a second publishing system. The docs route remains the
existing `/docs/*` route and the homepage links into the new Getting Started
section.

The requested TypeScript support is satisfied by the existing Docusaurus module
type aliases and repository TypeScript preset. The current
`@docusaurus/tsconfig` package is the supported Docusaurus configuration in
this workspace; `@tsconfig/docusaurus` will not be added merely to match a
package name when it provides no required behavior.

### Import design-system tokens, then add Docusaurus adapters

Add `@sibylhub/design-system` as an explicit workspace dependency of
`apps/docs`, because importing its exported token stylesheet requires the
package to be resolvable from the docs package. Import that stylesheet from
the docs stylesheet, map the HSL channel variables to Docusaurus theme
variables, and add only docs-specific layout, navigation, Markdown,
code-block, table, focus, and callout styles in `custom.css`.

The design-system stylesheet is the authority for Deep Obsidian
`230 24% 5%`, elevated surfaces, Electric Cyan/Oracle Blue, Telemetry Violet,
Geist/Inter and Geist Mono/JetBrains Mono stacks, semantic context colors, and
reduced-motion behavior. No remote font import or second palette definition
will be introduced. If Docusaurus's generated light-theme selectors require
overrides, they will be scoped to the docs theme and will preserve readable
contrast rather than changing the design-system source.

### Organize navigation around reader intent

Replace the flat sidebar with six named groups. The initial mapping will keep
existing content discoverable while assigning the new focused pages as follows:

- Getting Started: `intro`, `workspace`.
- `.agent/` Standard: the `.agent` specification page and `governance`.
- Context Governance: the Socraticode AST page and `runtime-boundaries`.
- Ecosystem Source of Truth (Context7): `schemas` and the invariant decision
  matrix.
- Audited Tools & FastMCP: a boundary/status page for the audited tool model.
- CLI Reference: a command reference page for `sibyl`.

Use stable nested doc IDs such as `agent-spec/specification`,
`algorithms/socraticode-ast`, `invariants/decision-matrix`,
`tools/fastmcp-boundary`, and `cli/commands`. Existing flat pages will either
remain at their current IDs or be moved only when every internal reference is
updated in the same change.

### Write content from contracts, with explicit evidence labels

The documentation pages will use checked-in source as follows:

- `.agent/` pages will explain the version `1.0` JSON contracts, declarative
  controls, fixed generated files, malformed-document behavior, and the
  difference between `init`, `check`, `memory add`, and `sync`.
- The context page will document Rules 10%, Memories 15%, AST Skeletons 35%,
  Active Files 30%, and Tools 10%, including exact-total deterministic integer
  allocation and the 128,000-token example.
- The AST/Socraticode page will describe structure-preserving skeletons and
  evidence/questions as data contracts that do not execute embedded commands
  or copy private source.
- The registry page will identify schema `2.0`, the split index/language-file
  layout, the exactly 25 language identities, stable references, PURLs, and
  local/public export boundaries.
- The decision matrix will show only package-policy values supported by a
  checked-in validated export. The current fixture's synthetic package IDs will
  be labeled as fixture examples; real banned libraries or migration recipes
  will not be invented when no concrete source record exists.
- The FastMCP/edge page will describe the explicit audit and authorization
  boundary and will state that the current repository has no first-party
  Rosie/FastMCP execution source. It will not imply that an unavailable
  runtime or sandbox is implemented, and it will link to the SibylHub
  Gateway documentation for the separately documented AI traffic gateway
  (`apps/gateway`), which is implemented but does not execute Rosie/FastMCP
  tools.
- The CLI page will reproduce the supported command forms, default paths,
  local registry-only behavior, sync prerequisites, bounded effects, and
  release build path from the CLI README and Clap definitions.

### Make link validation recursive and local

Update `scripts/validate-links.mjs` to enumerate Markdown files below
`apps/docs/docs/`, preserving deterministic ordering and the existing local
failure behavior. It will validate references to local documentation IDs or
files without fetching URLs. Docusaurus remains the final authority for route
resolution through `onBrokenLinks: "throw"` and
`onBrokenMarkdownLinks: "throw"`.

### Keep the homepage static and orientation-focused

Update the existing homepage component rather than introducing a client-side
application. It will present the official positioning, a concise contract
summary, and links to the six documentation areas. It will use semantic HTML,
visible focus states, and ordinary Docusaurus links; no hydration, API read, or
remote operation is needed.

### Resolve registry-source scope

This change will not add a normalized registry export or concrete banned-
library migration records. The documentation will cover the registry schema,
the 25 language identities, and the decision-matrix fields, while explicitly
labeling synthetic fixture values and reporting concrete policy values as
unavailable when no validated checked-in source exists. A future registry
data change must provide its own authoritative export and validation contract.

## Risks / Trade-offs

- [Risk] The normalized registry may not contain real package policy entries in
  the checked-out snapshot. -> Render the 25-language contract and policy
  schema, label synthetic fixture values, and mark concrete policy content as
  unavailable rather than fabricating recommendations.
- [Risk] Docusaurus theme defaults may override the dark-first token palette. ->
  Load design-system tokens first, map the required Docusaurus variables in a
  scoped adapter, and verify the rendered build at the default docs routes.
- [Risk] Moving flat documents into nested sidebar groups can create stale
  links. -> Keep IDs stable where possible, update all local references in one
  patch, run recursive validation, and rely on strict Docusaurus link failure.
- [Risk] The requested Rosie/FastMCP wording could be read as an implemented
  runtime. -> Use an explicit status section distinguishing checked-in
  contracts, the implemented SibylHub Gateway (which routes AI traffic but
  does not execute Rosie/FastMCP tools), and unavailable first-party
  execution source.
- [Risk] Package CSS exports are unavailable before the design-system package
  builds. -> Keep the workspace dependency and Turborepo build dependency
  graph intact, and verify the docs build from a clean generated-package
  sequence.

## Migration Plan

This is a static content and presentation migration with no remote rollout.
Update configuration, navigation, content, homepage, stylesheet, and local
validation together; then build the docs package and inspect the generated
routes. Rollback is a source-level revert of the docs change artifacts and
restoration of the prior five-page configuration. No database migration,
Cloudflare operation, registry publication, or synchronization is required.
