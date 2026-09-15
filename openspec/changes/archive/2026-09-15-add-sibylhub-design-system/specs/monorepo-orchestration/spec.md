## MODIFIED Requirements

### Requirement: The workspace exposes explicit application and package ownership

The repository SHALL expose `apps/web`, `apps/backoffice`, `apps/backend`, `apps/cli`, and `apps/docs` as distinct application roots, SHALL expose `packages/schemas`, `packages/typescript-config`, and `packages/design-system` as distinct shared-package roots, and SHALL document the runtime owner, dependency manager, local command, and build artifact for each root.

#### Scenario: A new contributor discovers the workspace

- **WHEN** the contributor follows the root workspace documentation
- **THEN** they can identify every requested application and shared package, including the design-system package, its owning toolchain, its local development command, and its generated output without inspecting dependency directories
