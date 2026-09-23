# Proposal

## Why

SibylHub now includes a capable Rust AI gateway, but the root workspace, task graph, and platform documentation do not yet recognize it as an application. Its existing AISIX identity also conflicts with the requested SibylHub product identity, leaving the gateway difficult to develop consistently and its ownership and role unclear.

## What Changes

- Establish the gateway as the **SibylHub Gateway**, a separately operated AI-traffic gateway; the web app, backoffice, backend API, CLI, and docs remain separate applications.
- **BREAKING:** Rebrand first-party gateway identity surfaces, including product-facing documentation and runtime metadata. Inventory existing `aisix` identifiers and define explicit compatibility aliases or migration guidance where renaming affects configuration, commands, headers, metrics, or deployments.
- Preserve the existing OpenAI-compatible, Anthropic, MCP, and A2A protocol contracts and provider integrations. Retain accurate upstream provenance and applicable license notices; do not present the gateway as hosting the rest of the SibylHub platform.
- Integrate `apps/gateway` into pnpm/Turborepo through a thin package bridge that invokes Cargo-native checks. Keep its existing Cargo workspace, lockfile, and Rust toolchain independent from the root Cargo workspace.
- Update root validation and developer documentation so the gateway's owner, commands, artifacts, and local-versus-deployment boundaries are discoverable. Coordinate gateway documentation with the in-progress `expand-docusaurus-documentation` change, whose current plan describes the gateway as unavailable.
- Keep this change local: it does not deploy the gateway or provision infrastructure, domains, provider credentials, or remote services.

## Capabilities

### New Capabilities

- `gateway-integration`: First-party gateway identity, protocol-preserving rebrand boundaries, and integration of the separately operated AI gateway into SibylHub.

### Modified Capabilities

- `monorepo-orchestration`: Add the gateway application and its native command/build-artifact contract to workspace discovery and root orchestration.
- `rust-platform-services`: Define how the gateway's independent Rust workspace participates in the repository's documented and validated Rust workflows.
- `documentation-site`: Require accurate gateway documentation, commands, product boundaries, and evidence boundaries.

## Impact

- Gateway source under `apps/gateway/`, including its Cargo manifests, configuration examples, container/development metadata, documentation, and branded runtime identifiers.
- Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, configuration/format dispatch scripts, and `README.md`.
- `apps/docs` content and its existing documentation change plan; the active Docusaurus proposal currently says the repository has no first-party gateway runtime.
- Existing monorepo, Rust-platform, and documentation-site specifications, plus a new gateway-integration specification.
- No root Cargo dependency consolidation is proposed. The gateway currently declares Apache-2.0 in its README and Cargo manifest, but a `LICENSE` file was not present in the inspected gateway tree; provenance and license evidence must be resolved before distribution claims are changed.
