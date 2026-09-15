## 1. Package and configuration foundation

- [ ] 1.1 Add `@sibylhub/design-system` as a workspace dependency of the docs package so its exported token stylesheet can be resolved, then verify the workspace dependency graph and lockfile remain consistent with `pnpm check:config` and `pnpm install --frozen-lockfile`.
- [ ] 1.2 Update `apps/docs/docusaurus.config.ts` with the official title, tagline, `https://docs.sibylhub.com` URL, dark-first color mode, strict broken-link settings, and Prism support for Rust, TypeScript, PHP, Python, Go, JSON, and TOML; verify it passes `pnpm --filter docs typecheck`.
- [ ] 1.3 Replace the flat sidebar in `apps/docs/sidebars.ts` with the six approved groups and stable document IDs, then verify every sidebar item resolves during `pnpm turbo run build --filter=docs`.

## 2. Visual system and homepage

- [ ] 2.1 Import the design-system token stylesheet into `apps/docs/src/css/custom.css` and add the Docusaurus adapter styles for Deep Obsidian `hsl(230 24% 5%)`, Electric Cyan/Oracle Blue, Telemetry Violet, Geist typography, code blocks, tables, focus states, and readable light-theme fallbacks; verify the required token values and reduced-motion rule are present in the generated stylesheet after a docs build.
- [ ] 2.2 Update `apps/docs/src/components/Homepage.tsx` with the official technical-reference positioning, semantic orientation content, and links to all six sidebar areas without adding hydration or remote reads; verify the home route renders in `pnpm --filter docs build` and the homepage TypeScript check passes.

## 3. Core documentation content

- [ ] 3.1 Rewrite `apps/docs/docs/intro.md` and `apps/docs/docs/workspace.md` to describe the mixed-runtime monorepo, package ownership, local commands, Turborepo build boundary, and separate local-versus-remote evidence; verify all documented commands and paths match the root and package manifests.
- [ ] 3.2 Add `apps/docs/docs/agent-spec/specification.md` documenting the schema-versioned `.agent/config.json`, `.agent/skills.json`, `.agent/memories.json`, and invariant contracts, fixed generated files, declarative-only controls, unknown-field rejection, and safe-content rules; verify every field and generated filename matches the checked-in JSON schemas and CLI implementation.
- [ ] 3.3 Update `apps/docs/docs/governance.md` with the complete `sibyl init`, `sibyl check`, and `sibyl memory add` governance lifecycle, conflict/force behavior, malformed-document handling, and no-execution/no-network guarantees; verify command syntax against `apps/cli/README.md` and `apps/cli/src/cli.rs`.
- [ ] 3.4 Add `apps/docs/docs/algorithms/socraticode-ast.md` documenting structure-preserving AST skeletons, Socraticode questions/evidence, the five context partitions, deterministic integer rounding, exact-total preservation, and the 128,000-token example; verify the percentages and example totals against the Rust platform specification.
- [ ] 3.5 Update `apps/docs/docs/runtime-boundaries.md` with the Astro/Cloudflare Worker, Laravel export, Rust snapshot, static Docusaurus, and explicit synchronization boundaries; verify it states that local docs commands do not mutate Cloudflare, DNS, databases, registry publication, or remote synchronization.

## 4. Registry, Context7, audited tools, and CLI reference

- [ ] 4.1 Update `apps/docs/docs/schemas.md` to explain legacy schema `1.0`, current registry schema `2.0`, split index/language artifacts, stable references, PURLs, Context7's optional documentation-context role, and the exactly 25 language identities; verify the language list and artifact paths against `packages/schemas/src/catalog.ts` and the checked-in registry fixture.
- [ ] 4.2 Add `apps/docs/docs/invariants/decision-matrix.md` with the 25-language decision matrix, invariant and package-policy relationship fields, severity/reason/replacement semantics, and migration guidance; verify that synthetic fixture package IDs are labeled as examples and that no concrete banned library or migration recipe is presented without a validated checked-in source.
- [ ] 4.3 Add `apps/docs/docs/tools/fastmcp-boundary.md` documenting the audited-tool and explicit-approval model, the Cloudflare/edge synchronization boundary, and the current absence of a first-party Rosie/FastMCP execution source; verify the page contains no claim of implemented sandboxing, tool execution, automatic installation, or automatic publication.
- [ ] 4.4 Add `apps/docs/docs/cli/commands.md` with exact forms and examples for `sibyl init`, `sibyl check`, `sibyl memory add`, and `sibyl sync`, including defaults, local registry precedence, JSON output, HTTPS/auth prerequisites, bounded retries, release build output, and the rule that `sync` alone may contact a remote service; verify every option against `apps/cli/src/cli.rs` and `apps/cli/README.md`.

## 5. Local validation and publication artifact

- [ ] 5.1 Extend `apps/docs/scripts/validate-links.mjs` to enumerate nested Markdown files deterministically and validate local documentation references without network access; verify it reports every current documentation file and fails on a deliberately introduced broken local reference before the reference is removed.
- [ ] 5.2 Run the docs package validation set—`pnpm --filter docs validate`, `pnpm --filter docs typecheck`, `pnpm --filter docs lint`, and `pnpm --filter docs format`—and verify content, TypeScript, strict-link, and formatting checks all pass.
- [ ] 5.3 Run `pnpm turbo run build --filter=docs`, verify `apps/docs/build/` is non-empty, and inspect the generated home route plus every sidebar document route for static, self-contained output with no backend or credential requirement.
- [ ] 5.4 Run the repository finish gates `pnpm check:config`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build`; record each result separately and report any unavailable external deployment or runtime evidence as untested.
