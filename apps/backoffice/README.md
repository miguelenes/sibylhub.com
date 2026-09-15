# SibylHub backoffice

The backoffice is the local Laravel source of truth for validated registry revisions. It owns the relational `RegistryRevision`, `RegistryEntry`, and `RegistryEntryRelationship` records and writes local exports under `storage/app/exports/registry`.

## Local setup

```sh
composer install --no-interaction
php artisan migrate
php artisan db:seed
php artisan test
vendor/bin/pint --test
```

The seeder reads the committed `packages/schemas/fixtures/valid-ecosystem.json` fixture and creates one deterministic valid revision plus its entries and relationships. The fixture is seed data only; `RegistryExportService` never falls back to it when the database has no valid revision.

`php artisan registry:export` validates the selected valid revision, its relational records, and shared contract constraints before writing a canonical local `ecosystem.json`. Publication is a separate explicitly guarded operation; ordinary tests and exports do not contact remote services.
