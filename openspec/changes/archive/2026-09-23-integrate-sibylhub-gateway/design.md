# Design

## Context

See `proposal.md` for the motivation.

The repository currently contains:

- A root pnpm/Turborepo workspace that already discovers `apps/*` and `packages/*`.
- Root `apps/backend` and `apps/cli` members in the top-level Cargo workspace, plus `apps/gateway` as an independent 18-crate Cargo workspace with its own `Cargo.lock` and Rust `1.93.1` toolchain.
- A gateway that is still branded as AISIX/API7 through its README, roadmap, container metadata, `aisix` executable, configuration/env namespace, headers, metrics, admin OpenAPI metadata, and supporting workflows and tools.
- An active `expand-docusaurus-documentation` change whose proposal and design currently state that no first-party gateway runtime exists.
- A gateway e2e harness that expects a locally built gateway binary and can require etcd or Redis; its upstream CI used a separate Node/pnpm environment and several local services.

The user confirmed that the gateway will handle SibylHub AI traffic. It will not host or serve the web app, backoffice, backend API, CLI, or documentation site.

## Goals / Non-Goals

**Goals:**

- Add `apps/gateway` as a first-class monorepo application with clear ownership and package tasks.
- Present the gateway as **SibylHub Gateway** while preserving protocol contracts and required provenance.
- Keep Cargo, its gateway lockfile, and the gateway's pinned toolchain authoritative for Rust dependency resolution.
- Update root configuration validation, documentation, and OpenSpec contracts so gateway tasks and boundaries are discoverable.
- Produce a deterministic inventory and migration matrix for every gateway-owned identifier affected by rebranding.

**Non-Goals:**

- Do not merge the gateway into the top-level Cargo workspace or change the root Rust toolchain.
- Do not move the gateway's Node test harness into the root pnpm workspace or lockfile.
- Do not rename OpenAI, Anthropic, MCP, A2A, Bedrock, Vertex, Azure OpenAI, etcd, Redis, or another established third-party identifier as SibylHub-owned branding.
- Do not deploy the gateway, publish an image, configure provider credentials, or mutate remote services.
- Do not replace the gateway's existing runtime behavior with a new architecture; this change is integration, identity, and documentation work.

## Decisions

### Use a thin gateway package bridge

Add `apps/gateway/package.json` so the existing root `apps/*` pnpm discovery and Turborepo graph can route tasks to the gateway. The bridge will invoke Cargo from the gateway workspace rather than declaring Rust dependencies in pnpm. This follows the existing `apps/backend` and `apps/cli` bridges while respecting the gateway's independent lockfile and toolchain.

Rejected alternatives:

- Merge the gateway into the root Cargo workspace: its dependency versions, lockfile, and toolchain differ materially from `backend`/`cli`; merging would force a large dependency reconciliation and undermine reproducible gateway validation.
- Add a second Turbo root or ignore the gateway: either hides a substantial application from the documented monorepo contract or duplicates orchestration unnecessarily.

### Route only deterministic offline tasks through the ordinary root graph

The proposed package tasks are:

- `build`: `cargo build -p <final-gateway-server-package> --bin <final-gateway-binary> --release --locked`
- `lint`: `cargo clippy --workspace --all-targets --locked -- -D warnings`
- `typecheck`: `cargo check --workspace --all-targets --locked`
- `format`: `cargo fmt --all -- --check`
- `test`: `cargo test --workspace --locked`
- `test:cov`: the same locked `cargo test` as the existing bridges, since `cargo llvm-cov` is not guaranteed to be installed locally
- `clean`: `cargo clean -p <final-gateway-server-package>`
- `dev`: run the gateway with a required local, untracked configuration file

These commands run inside `apps/gateway`, use its own lockfile, and are compatible with Turbo's package bridge. The `--release` build mirrors the `apps/backend` and `apps/cli` bridges and the root contract that `pnpm build` produces Rust release binaries; its output is `apps/gateway/target/release/<final-gateway-binary>`. The debug binary the e2e harness expects (`target/debug/<final-gateway-binary>`) is built by the separately documented prerequisite-dependent e2e task, not by the package `build` task.

`pnpm dev` should not start the gateway automatically because a local configuration file is required and it is not tracked. The gateway-only development command will be documented and used explicitly.

### Separate infrastructure-dependent and third-party conformance checks

The ordinary `test` task will not silently require etcd, Redis, provider credentials, or production connectivity. Gateway e2e and MCP-conformance tasks will be separately documented and explicitly excluded from the baseline local check where their prerequisites are unavailable. Their names will be stable and their required local services or Node environment will be documented.

The gateway e2e harness currently has no committed pnpm lockfile and its upstream workflow used a newer Node/pnpm environment than the root pnpm 9 contract. Do not integrate that harness into the root workspace lockfile. Its package bridge will invoke its own documented setup, while root validation remains pnpm-9 compatible.

### Rebrand first-party identity, not protocol or provider contracts

The rebrand must be evidence-driven rather than a blind search-and-replace. Classify every occurrence into:

1. **First-party identity** — rebrand to SibylHub Gateway.
2. **Gateway-owned external identifiers** — rebrand only with an alias or migration instruction; examples include the executable, config/env prefix, custom headers, metrics, and container paths.
3. **Standard protocol, provider, or upstream identity** — preserve.
4. **Control-plane integration** — preserve the exact wire contract unless a paired SibylHub control-plane contract exists; otherwise, document it as inactive or out of scope.
5. **Provenance and licensing** — preserve required notices and verify redistribution rights before changing distribution claims.

The first implementation pass will produce an identifier inventory and migration matrix. The matrix will state each current identifier, its classification, planned value, compatibility behavior, affected files, and test/evidence command. It will be reviewed before broad renaming begins.

### Preserve or replace control-plane features explicitly

The gateway's managed mode currently references an upstream external control plane. SibylHub has no verified replacement in this repository. The design must not advertise an unavailable SibylHub control plane. The implementation will either preserve the existing integration as an explicitly labeled upstream/compatibility surface or disable it behind documented configuration, depending on the inventory findings and user decision.

### Replace or clearly mark unverified brand assets

The existing console screenshots, architecture SVG, Discord/website links, badges, and demo URLs are upstream marketing assets. They cannot remain presented as SibylHub product evidence. Until approved replacement assets exist, remove them from first-party surfaces or replace them with an explicit placeholder/status label. The design-system token contract is not required by the gateway's current server-rendered admin/OpenAPI surface and will not be forced onto it without a concrete UI implementation.

### Coordinate the documentation changes

The active Docusaurus change is planned but has no completed tasks. Its proposal and design will be updated so the gateway is described as an integrated first-party application rather than unavailable. Gateway documentation will live in `apps/docs`, using the same static, local-build contract already required by `documentation-site`.

### Resolve license and provenance before distribution claims

The inspected gateway declares Apache-2.0 in its README and Cargo workspace but contains no `LICENSE` file. Before applying rebranding to distribution-facing metadata, preserve and verify the upstream license, copyright, and attribution evidence. If the license cannot be verified, stop and ask rather than asserting redistribution rights.

## Risks / Trade-offs

- **Identifier rebrand is broad and touches runtime behavior** → Build and review the classification/migration matrix first; require an alias or documented migration for every externally consumed identifier; add tests that cover old and new identifiers where compatibility is promised.
- **A blind search-and-replace could break protocol or provider integrations** → Classify third-party protocol/provider names as preserve; inspect every hit rather than doing a global replacement.
- **The gateway has heavy Rust dependencies and tests** → Keep the independent workspace and lockfile, run deterministic checks through the bridge, and separate infrastructure-dependent tasks.
- **Root `pnpm dev` could fail without local gateway configuration** → Exclude the gateway from the default parallel dev set and document its explicit gateway-only dev command.
- **Existing e2e harness conflicts with the root pnpm/Node contract** → Keep it out of the root lockfile and expose it only through an explicitly documented gateway package task with prerequisites.
- **Upstream license or provenance is incomplete** → Treat license verification as a blocking gate before changing distribution-facing claims.
- **The in-progress docs change still says no gateway exists** → Update that change's artifacts before or alongside gateway documentation so the two plans do not contradict each other.

## Migration Plan

1. Inventory gateway identifiers and produce the classification/migration matrix.
2. Resolve license/provenance and obtain approval for any identifier that cannot safely preserve compatibility.
3. Add the gateway package bridge and update root scripts, validation, Turbo inputs/outputs, and README ownership.
4. Rebrand first-party documentation and metadata, preserving required upstream attribution.
5. Rebrand gateway-owned runtime identifiers with aliases or documented migrations, regenerate affected schemas/OpenAPI where applicable, and add compatibility tests.
6. Replace or mark unverified brand assets.
7. Reconcile the Docusaurus change and add gateway documentation.
8. Run package and root validation, documenting any prerequisite-dependent checks that cannot run locally.

Rollback is a source-level revert of the gateway integration and rebranding changes. The independent gateway Cargo lockfile and toolchain remain separate throughout, so rollback does not require reconstructing the root Rust dependency graph.

## Open Questions

- None. Any implementation question that changes identity compatibility, control-plane behavior, documentation scope, or validation evidence will be escalated before proceeding rather than guessed.
