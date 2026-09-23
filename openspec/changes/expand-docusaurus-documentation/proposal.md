## Why

SibylHub has a working Docusaurus baseline, but its current five-page flat site
does not yet function as the official technical reference for the monorepo,
declarative `.agent/` contract, context-governance algorithms, ecosystem
registry, audited tool boundaries, or workstation CLI. The repository already
contains the source schemas, CLI behavior, and documentation-site contract;
this change makes those existing contracts discoverable through a coherent,
static, dark-first documentation portal without introducing a runtime
dependency or remote side effect.

## What Changes

- Reframe the existing Docusaurus site as the official SibylHub documentation
  portal with the requested title, tagline, `docs.sibylhub.com` publication
  URL, and Obsidian/Cyan visual language.
- Configure the Docusaurus TypeScript site and Prism highlighting for the
  repository's documented Rust, TypeScript, PHP, Python, Go, JSON, and TOML
  examples while retaining the existing monorepo package bridge and static
  `build/` output contract.
- Replace the single flat sidebar with six information groups: Getting
  Started; the `.agent/` Standard; Context Governance; Ecosystem Source of
  Truth (Context7); Audited Tools & FastMCP; and CLI Reference.
- Preserve and reorganize the existing workspace, schema, governance, and
  runtime-boundary pages, and add the requested focused pages for `.agent/`
  specification, invariant decision-making, and Socraticode AST compression.
- Document the exact local command surface for `sibyl init`, `sibyl check`,
  `sibyl memory add`, and `sibyl sync`, including their non-executing and
  remote-authorization boundaries.
- Document the 25-language registry contract, versioned schema relationships,
  deterministic context partitions, Context7 retrieval boundary, and
  deployment/security separation using current repository evidence.
- Add the requested Deep Obsidian, Electric Cyan, Telemetry Violet, Geist, and
  reduced-motion styling, with readable code blocks and accessible state
  treatments.
- Extend local documentation link validation to cover nested documentation
  paths and verify broken links/configuration fail before publication.
- Keep all documentation commands self-contained and local: no backend,
  database, credentials, remote registry synchronization, Cloudflare mutation,
  or project-code execution is required to build the site.
- Describe the audited Rosie/FastMCP and edge-gateway boundary only to the
  extent supported by repository evidence, clearly distinguishing current
  contracts from unavailable or planned first-party runtime sources. The
  SibylHub Gateway (`apps/gateway`) is an integrated first-party application
  with its own documentation scope; the boundary page must not present
  Rosie/FastMCP execution as implemented when it is not.

## Capabilities

### New Capabilities

None. This is a documentation and presentation change; it does not introduce a
new runtime capability or a new behavioral contract.

### Modified Capabilities

None. The existing `openspec/specs/documentation-site/spec.md` already defines
the required documentation coverage, command accuracy, deterministic static
build, broken-link failure, and local-only quality-check behavior. This change
captures implementation and content work against that existing contract, so
the change metadata sets `skip_specs: true`.

## Impact

- Primary package: `/home/swarmnet/Projects/sibylhub.com/apps/docs`.
- Expected implementation files include the Docusaurus configuration,
  sidebar definition, homepage presentation, custom CSS, link-validation
  script, and Markdown content under `apps/docs/docs/`.
- The existing `@sibylhub/design-system` token source will remain the visual
  authority, and `@sibylhub/design-system` will be added as the docs package's
  workspace dependency so its exported `./tokens` stylesheet can be resolved.
  Any other package-manifest or lockfile edit will be limited to a demonstrated
  dependency gap; the current supported `@docusaurus/tsconfig` setup will not
  be replaced speculatively.
- No application APIs, database schemas, Cloudflare resources, registry
  exports, credentials, or remote synchronization behavior will change.
- Validation will include the docs package checks and the repository's
  documented finish gates, with `pnpm turbo run build` producing a non-empty
  `apps/docs/build/**` artifact.
