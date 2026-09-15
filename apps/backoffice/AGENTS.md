# Backoffice guidance

Laravel and Composer own this application. Filament owns the `/admin` panel and registry editing boundary. SQLite, array cache/session, and synchronous queues are the local defaults. The registry export command reads validated local state and writes only `storage/app/exports`; publication is a separate guarded command.

Run `composer install`, `php artisan about`, `php artisan route:list`, `php artisan test`, and `vendor/bin/pint --test`. Do not connect this application to the Rust backend database or add remote publication to ordinary tests.
