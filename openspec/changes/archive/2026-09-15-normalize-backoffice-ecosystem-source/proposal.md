## Why

The backoffice currently stores ecosystem metadata as a revision JSON payload plus generic entries and relationships. That shape can validate a published document, but it does not provide the relational source of truth, typed administration surface, or stable domain relationships needed to govern languages, runtimes, package managers, builders, invariants, and documentation independently.

This change establishes the normalized Laravel/Filament source model and aligns the public export contract with the shared schema package before implementation begins.

## What Changes

- **BREAKING**: Replace the current generic-entry-only registry source model with a normalized ecosystem domain model covering the requested 14 tables and 13 Eloquent models.
- Add strict migrations, typed Eloquent relationships, casts, fillable attributes, and save-time validation for ecosystem records and stack invariants.
- Add Filament 5 resources and relation managers for the language, package-manager, package, and invariant administration workflows.
- Define deterministic serialization from normalized records, including revision identity, stable ordering, relationship resolution, and schema validation.
- Define the accepted schema `2.0` public artifact layout (`data/v1/index.json` and per-language files) as an explicit shared contract rather than inventing fields during implementation.
- Add feature coverage for relational constraints, invariant scoping, Filament resource discovery, export determinism, and schema alignment.
- Add a supported direct Pest/Laravel test integration compatible with the installed PHP, Laravel, Filament, and PHPUnit versions while preserving existing PHPUnit compatibility.
- Keep local export and remote publication as separate safety boundaries: `registry:export-public` remains local-only, while a separately authorized publisher may write validated artifact bytes through `Storage::disk('r2-public')`.

## Capabilities

### New Capabilities

- None. This change extends existing backoffice and shared-contract capabilities.

### Modified Capabilities

- `backoffice-ecosystem-source`: change the canonical source from generic revision payload entries to normalized relational ecosystem records, add typed Filament administration, and revise export behavior and validation around the normalized source.
- `shared-schemas`: define and version the accepted schema `2.0` public registry artifact layout, while preserving canonical identifiers, PURL validation, complete vocabulary, and cross-runtime consumption.

## Impact

- Affected application areas: `apps/backoffice/database`, `apps/backoffice/app/Models`, `apps/backoffice/app/Filament`, `apps/backoffice/app/Console`, configuration, seed data, and feature tests.
- Affected shared contract areas: `packages/schemas` JSON Schema, TypeScript types/validators, fixtures, and cross-runtime contract tests.
- Existing `RegistryRevision`, `RegistryEntry`, `RegistryEntryRelationship`, seeding, export, and publication flows require migration or compatibility treatment; they must not be silently left as a second source of truth.
- Composer dependencies and test configuration may change to support the requested Pest suite and R2-compatible storage fakes. No credentials or live provider configuration will be committed.
- Normal local boot, tests, and export validation remain independent of production databases, queues, providers, and remote storage. Remote publication remains separately authorized unless the revised contract explicitly says otherwise.
