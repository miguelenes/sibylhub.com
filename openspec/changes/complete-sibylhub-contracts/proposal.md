## Why

The monorepo bootstrap established the application boundaries and local orchestration, but several consumers do not yet honor the shared contracts they are meant to enforce. The schemas package cannot be consumed from its published build, CLI-generated governance metadata does not satisfy the declared contract, backend invariant validation trusts caller input, and registry exports can fall back to fixture data or vary by collection ordering.

This follow-up closes those contract-consumer gaps before the platform is treated as a dependable source of truth.

## What Changes

- Publish self-contained, versioned JSON Schema and TypeScript artifacts for ecosystem documents, agent configuration, skills, and invariant rules.
- Strengthen ecosystem schema generation and validation so required entry fields, PURLs, stable relationships, and supported schema versions are enforced consistently.
- Align `sibyl init` output with the shared `.agent/` contract and make `sibyl check` validate governance metadata, supported manifests, and selected invariant evidence without executing project code.
- **BREAKING** Replace the backend's client-supplied invariant compliance result with an evidence-based request evaluated against the versioned registry snapshot and returned with structured validation diagnostics.
- Make backoffice registry export depend on validated revision data, normalize every exported collection deterministically, and preserve the local-only publication boundary.
- Add focused fixtures and cross-runtime tests for valid documents, malformed documents, unresolved relationships, unsafe content, invariant violations, and deterministic export output.
- Keep the existing runtime ownership, secret boundaries, explicit remote authorization, and Rust binary naming unless a later decision changes them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-schemas`: require complete, self-contained, versioned artifacts and consistent validation across workspace boundaries.
- `rust-platform-services`: require schema-valid CLI initialization, evidence-based invariant checking, and server-side backend invariant evaluation.
- `backoffice-ecosystem-source`: require authoritative validated revisions and byte-stable deterministic public exports.

## Impact

- `packages/schemas` build outputs, JSON Schema files, validators, fixtures, and package-consumer tests.
- `apps/cli` initialization/check commands, Rust dependencies, diagnostics, and local fixtures.
- `apps/backend` invariant request/response types, registry evaluation logic, and API tests.
- `apps/backoffice` registry export service, validation/serialization tests, and any revision-loading boundary required by the source-of-truth model.
- Root Turborepo task inputs and finish-gate documentation only where needed to verify the corrected contracts.
