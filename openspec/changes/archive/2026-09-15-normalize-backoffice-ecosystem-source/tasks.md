## 1. Shared Contract and Fixtures

- [x] 1.1 Define the schema `2.0` split artifact contract for `data/v1/index.json` and `data/v1/languages/{slug}.json`, including required fields, stable identifiers, relationship references, PURL rules, and unsupported-version errors; verify the JSON Schema validates representative valid and invalid fixtures.
- [x] 1.2 Update the shared TypeScript types, validators, package exports, and generated artifact configuration for the split contract while retaining explicit legacy `1.0` validation; verify the package builds and its packaged exports resolve without source-relative imports.
- [x] 1.3 Create deterministic 25-language split fixtures and cross-file consistency fixtures covering mismatched identities, invalid paths, unresolved references, malformed PURLs, unsafe fields, and volatile timestamps; verify the TypeScript validator accepts only the intended fixtures.
- [x] 1.4 Add cross-runtime contract coverage for schema version, snapshot identity, stable identifiers, complete vocabulary, PURLs, and rejection behavior; verify the shared contract tests pass independently of the Laravel database or remote services.

## 2. Dependencies and Configuration

- [x] 2.1 Add direct Pest/Laravel test dependencies using versions compatible with the installed PHP, Laravel, Filament, and PHPUnit contract without downgrading existing packages; verify `composer validate`, `composer install`, and the configured test runner succeed.
- [x] 2.2 Add the AWS-compatible Flysystem adapter only if the installed filesystem bridge requires it for R2; verify Composer resolves the adapter without changing unrelated runtime dependency constraints.
- [x] 2.3 Change backoffice schema configuration to `2.0`, preserve an explicitly named legacy `1.0` validation path, and keep the local export root environment-driven; verify configuration caching and `php artisan about` succeed without production services.
- [x] 2.4 Add an optional environment-driven `r2-public` filesystem disk and non-secret example variable names without making it the default disk or requiring credentials for local boot; verify the application boots with all R2 variables unset.

## 3. Domain Enums and Database Schema

- [x] 3.1 Add backed PHP string enums for runtime engine type, registry PURL type, lockfile format, lockfile version standard, workspace format, and invariant severity; verify unsupported values fail model/form validation while SQLite stores the documented strings.
- [x] 3.2 Create the normalized migration for all 14 tables in dependency order with explicit indexes, nullable/default columns, composite package slug uniqueness, polymorphic documentation indexing, and portable string enum columns; verify a fresh SQLite migration creates every table and index.
- [x] 3.3 Add foreign-key actions for owned cascades, optional null-on-delete references, required restrict-on-delete references, builder-language cascades, and documentation-chunk cascades; verify deletion integration tests show no dangling required records and preserve restricted parents.
- [x] 3.4 Handle the programming-language/default-package-manager cycle and delayed stack-invariant package keys in migrations; verify migrations run from an empty database and rollback/forward ordering does not require disabled foreign-key checks.

## 4. Eloquent Models and Persistence Invariants

- [x] 4.1 Implement the 13 normalized model classes with strict types, `HasFactory`, explicit `$fillable`, method-based casts, backed-enum casts, and typed relationships; verify model booting and relation metadata for every normalized table.
- [x] 4.2 Implement `PackageRuntimeCompatibility` as the explicit domain `Pivot` model and keep `builder_language` as a plain many-to-many pivot; verify compatibility notes/flags and builder-language relations round-trip through SQLite.
- [x] 4.3 Add `StackInvariant` persistence validation rejecting equal approved and banned package IDs for every non-panel write path; verify model, factory, and database-backed feature tests reject the invalid pair.
- [x] 4.4 Add factories or deterministic model builders for the normalized records without embedding secrets or remote identifiers; verify tests can construct a complete 25-language graph using only local SQLite state.

## 5. Legacy Import and Normalized Seeding

- [x] 5.1 Implement a transactional import that maps the committed valid fixture and available valid legacy revision into normalized records by stable identity, failing closed on unmappable values; verify a malformed source reports field-level diagnostics and leaves no partial transaction.
- [x] 5.2 Make normalized seeding idempotent by stable slug/composite identity and prevent runtime reads from fixtures or legacy payloads; verify repeated seeding produces the same row counts and unchanged canonical source data.
- [x] 5.3 Add normalized readback comparison for language counts, relationship counts, stable IDs, compatibility evidence, and required fields; verify the importer refuses to complete when readback differs from the source mapping.
- [x] 5.4 Document and test the clean-database behavior where no valid normalized catalog exists; verify export fails non-zero without consulting fixtures or generic registry payloads.

## 6. Filament Administration

- [x] 6.1 Implement `ProgrammingLanguageResource` with reviewable slug generation, extension tags, normalized fields, and Runtime/PackageManager relation managers; verify authorized panel navigation discovers the resource and relation workflows persist valid records.
- [x] 6.2 Implement `PackageManagerResource` with language, optional registry/PURL, manifest, lockfile, install/add command, binary, lockfile specification, and workspace configuration fields; verify unsupported enum values and invalid relationships are rejected in the form.
- [x] 6.3 Implement `PackageResource` with package-manager/category relationships, manager-scoped slug validation, opinionated toggle, URLs/license, and Markdown rationale; verify duplicate scoped slugs are rejected and rationale remains non-executable text.
- [x] 6.4 Implement `StackInvariantResource` with distinct approved/banned selectors, optional runtime/framework scope, severity badges, reason, migration URL, and syntax-readable replacement code; verify the same package cannot be selected twice and replacement content is never evaluated.
- [x] 6.5 Verify Filament resource discovery, panel authentication/authorization responses, navigation labels, and route registration; run `php artisan route:list --except-vendor` and the focused resource-loading tests.

## 7. Canonical Normalized Export

- [x] 7.1 Implement a normalized-source reader that eagerly loads the complete export graph with bounded selected columns and rejects missing required records or unresolved relationships; verify the reader performs no fixture, legacy-payload, package-manager, scraper, or provider fallback.
- [x] 7.2 Implement canonical graph normalization that removes database IDs/timestamps/volatile fields, sorts stable identities and nested collections, and recursively sorts object keys; verify equivalent row insertion orders produce identical canonical bytes.
- [x] 7.3 Implement `sha256:<lowercase-hex>` revision identity over the declared schema version and canonical normalized graph; verify the identity changes for meaningful source changes and remains stable across repeated exports and database IDs.
- [x] 7.4 Implement the pure split serializer producing one index and exactly 25 language artifact payloads with matching schema/revision identities, stable paths, resolved relationships, catalog-only PURLs using `managed`, and globally discoverable builders; verify serializer output against the shared schema fixtures.
- [x] 7.5 Implement pre-write structural, completeness, identity, relationship, PURL, secret, and unsafe-directive validation; verify invalid source data returns actionable diagnostics and writes no partial artifact tree.
- [x] 7.6 Implement the local artifact writer and update `registry:export-public` to write only the validated revision-scoped local tree, report the computed identity/path, and reject obsolete legacy revision-selection behavior; verify repeated command runs are byte-identical and never resolve the R2 disk.

## 8. Explicit R2 Publication Boundary

- [x] 8.1 Implement a separate authorized publisher that accepts only a previously validated local artifact tree, writes exact bytes through `Storage::disk('r2-public')`, and uses revision-scoped paths; verify missing authorization, missing configuration, or invalid local artifacts fail before any remote write.
- [x] 8.2 Add fake-disk publication tests that independently read back every uploaded artifact and distinguish remote convergence from local export success; verify ordinary export, administration, and test setup do not invoke the R2 disk.

## 9. Test Suite and Local Gates

- [x] 9.1 Add Pest feature coverage for migrations, scoped slugs, equal invariant packages, global/runtime-scoped invariants, complete normalized import, and clean-database failure; verify tests run with SQLite, array cache/session, and synchronous queues.
- [x] 9.2 Add export and shared-schema integration coverage for deterministic bytes, split-file identity/path consistency, complete 25-language output, invalid PURLs, unresolved relationships, unsafe fields, and local-only behavior; verify PHP and TypeScript validators agree on shared fixtures.
- [x] 9.3 Run the documented backoffice checks: `composer install`, `php artisan about`, `php artisan route:list`, `php artisan test`, coverage, and `vendor/bin/pint --test`; record each result separately and leave remote publication unrun unless explicitly authorized.
- [x] 9.4 Run the repository package checks required by the changed workspaces, including `pnpm check:config`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build`; verify failures are reported by package and are not replaced by narrower checks.

## 10. Legacy Cutover and Final Review

- [x] 10.1 After normalized import, readback, local export, and shared-contract gates pass, remove generic registry writes and fixture fallback paths from runtime administration/export flows; verify no production code path mutates or reads both sources.
- [x] 10.2 Add a separately reviewable cleanup migration and model/command retirement for the generic registry tables only after the cutover evidence is recorded; verify legacy data remains recoverable until cleanup is intentionally applied.
- [x] 10.3 Perform a final contract and security review for tracked secrets, private keys, executable replacement content, implicit remote writes, unstable ordering, and live-service dependencies; verify the complete OpenSpec change and local validation evidence before any authorized deployment or publication.
