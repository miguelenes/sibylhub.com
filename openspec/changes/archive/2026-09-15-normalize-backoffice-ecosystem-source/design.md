## Context

See `proposal.md` for the motivation and scope. The current backoffice is Laravel 12 with Filament 5, SQLite-friendly local defaults, one generic registry revision/payload model, and a local exporter that emits the existing single-document `1.0` ecosystem contract. The current shared TypeScript contract and JSON Schema require top-level collections and use `revisionId`; they do not describe the requested split artifact tree.

The change crosses the backoffice database, Eloquent and Filament boundaries, the shared schema package, Composer test dependencies, local export storage, and an optional Cloudflare R2 publication boundary. Local startup, tests, and export validation must remain independent of production services. No existing generic and normalized sources may remain independently mutable after cutover.

## Goals / Non-Goals

**Goals:**

- Make normalized ecosystem records the single mutable source used by administration, validation, seeding, and export.
- Preserve stable identities independently of auto-increment database IDs.
- Define an exact split artifact contract before serializer implementation.
- Keep the local exporter deterministic, locally inspectable, and remote-side-effect-free.
- Provide an explicit migration/import and readback boundary for existing valid registry data.
- Keep the database portable across SQLite local tests and supported production databases.
- Cover database constraints, Filament discovery, export determinism, schema validation, and authorized publication with local tests.

**Non-Goals:**

- Connecting the backoffice to the Rust backend database.
- Running package managers, builders, scrapers, or arbitrary replacement code from the panel.
- Making R2 credentials or a live provider necessary for local boot, tests, or local export.
- Maintaining the generic registry tables as a second mutable source after normalized cutover.
- Adding an implicit upload, deployment, or production publication step to `registry:export-public`.

## Decisions

### Canonical source and legacy cutover

The normalized ecosystem tables become the only mutable source of registry data. The existing `RegistryRevision`, `RegistryEntry`, and `RegistryEntryRelationship` tables and models are treated as legacy migration inputs, not as mirrors or fallbacks. A one-time import reads the valid local fixture/current valid revision, maps it into normalized records, validates the complete graph, and records a readback report. After that report passes, administration and export stop writing or reading the generic tables. The legacy tables remain until the migration has been verified and can then be retired in a separate cleanup migration.

The word “revision” remains in the public contract for compatibility, but it no longer means a mutable revision row. `revisionId` is the content identity of the normalized source snapshot. Any legacy command option that selects a database revision is removed or rejected after cutover; export selects the current valid normalized graph and reports its computed `revisionId`.

This avoids a dual-write design in which JSON payloads and normalized rows could diverge. It also makes an empty or invalid normalized database fail closed instead of silently consulting committed fixture data.

### Normalized relational model

The migration creates the requested 14 tables in dependency order. The table-level contract is:

| Table                           | Required domain data and relationship policy                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `programming_languages`         | `name`, globally unique `slug`, JSON `extensions`, nullable `default_package_manager_id`; the default-manager foreign key is added after package managers exist.                                                         |
| `runtimes`                      | `programming_language_id`, `name`, globally unique `slug`, backed `engine_type` value, nullable `version_manager`. Language ownership cascades.                                                                          |
| `package_registries`            | Registry identity and URLs, backed `purl_type`, and namespace-support flag. It has no required parent.                                                                                                                   |
| `package_managers`              | Required language, nullable registry, identity, binary/manifest/lockfile values, install/add commands, and workspace-related configuration. Language ownership cascades; registry deletion nulls the optional reference. |
| `lockfile_specifications`       | Required package manager, filename, backed format and version-standard values, and frozen-install flag. Manager ownership cascades.                                                                                      |
| `workspace_configurations`      | Required package manager, manifest, backed format, glob key, and isolated-install flag. Manager ownership cascades.                                                                                                      |
| `package_categories`            | Name, globally unique slug, and nullable description. Deletion is restricted while a required package or invariant reference remains.                                                                                    |
| `packages`                      | Required manager and category, name, manager-scoped slug, package/homepage/repository URLs, license, opinionated flag, and nullable Markdown rationale. Manager ownership cascades; category deletion is restricted.     |
| `package_runtime_compatibility` | Required package and runtime, compatibility flag, and nullable notes. Both parent deletions cascade.                                                                                                                     |
| `stack_invariants`              | Required category, approved package, banned package, severity, reason; nullable target runtime, framework package, replacement example, and migration URL. Package deletion is restricted while referenced.              |
| `builders`                      | Name, globally unique slug, JSON configuration filenames, and run command. Builder deletion is restricted while a published language relationship requires it.                                                           |
| `builder_language`              | Plain many-to-many pivot between builders and programming languages. Both parent deletions cascade.                                                                                                                      |
| `documentations`                | Polymorphic documentable type/ID, source and optional R2 keys, content hash, token count, and scrape timestamp. The polymorphic target has an indexed pair but no database foreign key.                                  |
| `documentation_chunks`          | Required documentation parent, chunk ordering/offset metadata, token count, and summary. Documentation deletion cascades.                                                                                                |

The migration uses explicit indexes for all foreign keys and lookup fields. Language, runtime, category, and builder slugs are globally unique. Package slugs are unique by `(package_manager_id, slug)` so different package ecosystems may use the same slug. Required relationship deletion is restricted where deleting the parent would invalidate a source record; owned children and relationship rows cascade; optional references null on deletion.

The language/default-manager cycle is resolved by creating `programming_languages` with a nullable, temporarily unconstrained column, creating registries and managers, then adding the foreign key. Self-referencing invariant package foreign keys are created only after `packages` exists.

### Portable domain enums and model boundary

Domain enumerations are backed PHP string enums stored in portable string columns rather than database-native enum columns. This keeps SQLite migrations and production database migrations equivalent while allowing model casts and application validation to reject unsupported values. The enum sets are defined once for runtime engine type, registry PURL type, lockfile format, lockfile version standard, workspace format, and invariant severity.

The implementation has 13 model classes for 14 tables. `PackageRuntimeCompatibility` is an explicit domain `Pivot` model because its compatibility flag and notes are meaningful behavior. `builder_language` remains a plain `belongsToMany` pivot. Every normalized model uses strict types, `HasFactory`, explicit `$fillable`, method-based casts, and typed relationship methods. All write paths use the same model/database invariants; Filament validation is an early user-facing layer, not the authority for non-panel callers.

`StackInvariant` rejects equal approved and banned package IDs before persistence. Foreign keys, scoped unique indexes, and deletion restrictions remain independent database protections rather than being replaced by model events.

### Stable identity and revision hashing

Auto-increment IDs are private relational identifiers and never form part of public identity. Export identities use canonical slugs and documented composite identifiers. Relationship collections are represented by stable IDs derived from those identities.

The serializer builds a normalized, JSON-compatible graph with database IDs, timestamps, and other volatile fields removed. It sorts records by stable identity, sorts nested collections, recursively sorts object keys, and serializes with one canonical JSON policy. The `revisionId` is `sha256:` followed by the lowercase SHA-256 digest of the canonical normalized graph plus the declared schema version. The same source graph therefore produces the same revision ID across databases and repeated exports.

The current contract version is `1.0`; changing from one top-level document to a split artifact set is a breaking contract change, so the split artifacts declare schema version `2.0`. The public directory remains `data/v1` because it denotes the first split layout, not the schema major. The backoffice default schema configuration changes to `2.0`, and the old `1.0` validator remains available only for explicitly identified legacy fixtures during migration.

### Split artifact contract

The canonical serializer emits a revision-scoped local tree:

```text
storage/app/exports/registry/{revisionId}/data/v1/index.json
storage/app/exports/registry/{revisionId}/data/v1/languages/{language-slug}.json
```

The master index has this semantic shape:

```json
{
  "schemaVersion": "2.0",
  "revisionId": "sha256:<lowercase-hex>",
  "languages": [
    {
      "id": "javascript",
      "slug": "javascript",
      "name": "JavaScript",
      "path": "languages/javascript.json"
    }
  ],
  "builders": [
    {
      "id": "builder-javascript",
      "slug": "javascript",
      "name": "JavaScript builder"
    }
  ]
}
```

The index contains exactly the 25 canonical language entries and globally discoverable builder identities. Each language file has the same `schemaVersion` and `revisionId`, then contains the language record plus its resolved runtimes, package registries, package managers, lockfile specifications, workspace configurations, package categories, packages, compatibility records, builders, stack invariants, documentation records, and documentation chunks. All collection entries carry stable IDs and relationship fields; no consumer infers a relationship from array position or an implicit default.

The normalized database does not store a release version for every catalog entity. For catalog-only PURLs, the serializer uses the documented reserved version `managed`; package registry type and namespace rules still come from the normalized registry record, and package URLs remain separate source URLs. This preserves the existing PURL shape without adding an unrequested package-version column or inventing a release version.

The shared package owns the JSON Schemas, TypeScript types, validators, and split fixtures. The PHP exporter owns the normalized graph assembly and performs the same required structural, identity, relationship, PURL, secret, and completeness checks before writing. Cross-runtime tests validate identical accepted and rejected fixtures; the normal local PHP command does not require a production service or an implicit Node process.

### Serializer, local export, and publication

The exporter is divided into three boundaries:

1. A normalized-source reader loads the complete graph with explicit eager loading and rejects missing required records.
2. A pure canonical serializer returns the index/language artifact map, computed `revisionId`, and validation diagnostics without writing to a remote service.
3. A local writer persists the complete artifact map under the configured local export root only after validation succeeds.

`registry:export-public` invokes all three local boundaries and returns the revision identity and local artifact directory. It never resolves `r2-public` and never uploads. A separate guarded publication operation accepts only a previously validated local artifact directory and an explicit authorization signal, then writes the exact artifact bytes through `Storage::disk('r2-public')`. Publication uses versioned/revision-scoped paths and verifies the target write/read result independently; local export success is not reported as remote convergence.

The R2 disk is configured from environment-backed endpoint, bucket, access-key, secret, and region values. The disk is not the default filesystem and may be absent in local environments. The AWS-compatible Flysystem adapter is added only if required by the installed filesystem bridge. Tests use `Storage::fake('r2-public')` for the publisher and assert that ordinary exporter tests never resolve or call the remote disk.

### Seed/import and data validation

The normalized seed/import command or seeder is idempotent by stable slug/identity and runs inside a transaction. It maps the committed valid fixture and, where present, the current valid legacy revision into normalized rows. It fails with a field-level mapping error when a source value cannot be represented, rather than dropping data or inventing a default. After import, it reads the normalized graph back and compares language counts, relationship counts, stable IDs, and required compatibility evidence against the source.

The runtime exporter never reads the fixture or legacy payload as a fallback. A clean database with no valid normalized catalog produces a non-zero export result. Seed data is local and deterministic; no provider, scraper, package manager, or R2 connection is needed.

### Filament administration

The existing `/admin` panel remains the authentication boundary. Resources are discovered from the existing resource directory and operate only on normalized models. Programming languages expose slug generation, extension tags, runtimes, and package managers through relation workflows. Package managers expose language, optional package registry/PURL settings, manifest/lockfile/workspace configuration, and commands. Packages expose category, opinionated status, and Markdown rationale. Stack invariants expose separate package selectors, runtime/framework scope, severity, reason, migration URL, and a non-executable syntax-readable replacement example.

Panel validation prevents obvious invalid submissions and improves error messages, while model/database rules protect imports, Artisan commands, and other non-UI writes. Replacement examples are rendered as text/code only and are never evaluated.

### Test and dependency strategy

The test suite keeps SQLite in-memory/local defaults and database isolation. Pest and its Laravel integration are added as direct development dependencies using the newest versions resolved as compatible with the existing PHP/Laravel/Filament/PHPUnit contract; no existing framework or PHPUnit dependency is downgraded. PHPUnit remains available because Laravel’s test runner and existing tests depend on it.

Tests cover migration constraints, scoped uniqueness, equal invariant package rejection, runtime/global invariant selection, Filament resource discovery, deterministic repeated export, split-schema validation, missing-language failure, local-only export, and the separately authorized fake-R2 publisher. The documented backoffice gates remain the final local evidence: `php artisan about`, route inspection, tests/coverage, Pint, and asset/build checks as applicable.

## Risks / Trade-offs

- [Risk] Legacy JSON data may not contain enough information for every normalized field. → [Mitigation] Use an explicit transactional import with fail-closed field diagnostics and a normalized readback report; do not silently invent values.
- [Risk] Schema version `2.0` requires every downstream consumer to understand the split artifact set. → [Mitigation] Update the shared package and cross-runtime fixtures first, retain an explicit legacy `1.0` validator during migration, and reject unknown versions rather than guessing.
- [Risk] A content-addressed revision differs from the current mutable revision-row semantics. → [Mitigation] Publish the canonical hash in every artifact and keep revision selection/documentation explicit; do not retain a second mutable revision source.
- [Risk] Split files can be mixed across revisions. → [Mitigation] Require matching schema/revision identities, validate the complete local tree before publication, and publish revision-scoped paths.
- [Risk] Restrictive package/category deletion can make administration less convenient. → [Mitigation] Surface dependent invariant/package relationships and require an intentional update before deletion.
- [Risk] Eager-loading the complete catalog can increase memory usage. → [Mitigation] Use bounded 25-language source data, select only export columns, avoid N+1 queries, and measure the serializer in the export test.
- [Risk] A syntactically valid R2 configuration may still be operationally wrong. → [Mitigation] Keep publication separate, use fake-disk tests, verify remote writes independently, and report remote convergence as a distinct gate.
- [Risk] Adding Pest and an S3-compatible adapter expands the Composer lockfile. → [Mitigation] Resolve versions against the installed contract, retain PHPUnit compatibility, and verify Composer plus the existing backoffice gates before implementation is considered complete.

## Migration Plan

1. Update the shared schemas, TypeScript types, validators, and fixtures for split schema `2.0`, while retaining an explicit legacy `1.0` validation fixture.
2. Add normalized migrations in dependency order, including the delayed default-manager foreign key, self-referential invariant keys, scoped unique indexes, polymorphic documentation index, and documented deletion actions.
3. Add strict typed models, enum casts, factories/seed support, and the transactional normalized import. Run the readback comparison before changing the exporter.
4. Add Filament resources and relation workflows, then verify panel navigation and validation behavior against the normalized models.
5. Implement the pure canonical serializer, PHP structural validator, local artifact writer, and `registry:export-public`. Verify repeatability and complete-tree failure behavior before adding remote code.
6. Add the guarded publisher, optional `r2-public` configuration, fake-disk tests, and independent publication readback. Do not invoke this boundary from ordinary export or tests.
7. Add the direct Pest integration without downgrading installed dependencies, run the documented backoffice and shared-schema validation gates, and review all generated artifacts.
8. After normalized import and local export have passed, retire the generic registry tables/models and legacy seeding path in a separately reviewable cleanup step. Only then consider an explicitly authorized remote publication.

Rollback is staged. If import or readback fails, leave the legacy source and exporter intact and do not drop its tables. If application code must be rolled back after normalized migrations, preserve the normalized tables and return to the last validated exporter rather than destructively reversing source data. Remote rollback is handled by the publisher’s revision-scoped artifact policy, not by a local database rollback.
