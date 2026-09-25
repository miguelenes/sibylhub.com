<?php

return [
    'schema_version' => env('SIBYL_SCHEMA_VERSION', '2.0'),
    'legacy_schema_version' => '1.0',
    'schema_root' => dirname(base_path(), 2).'/packages/schemas',
    'export_root' => env('SIBYL_EXPORT_ROOT') ?: storage_path('app/exports/registry'),
    'ingestion' => [
        'enabled' => env('SIBYL_INGESTION_ENABLED', false),
        'scope' => 'packages:ingest',
        'max_request_bytes' => (int) env('SIBYL_INGESTION_MAX_REQUEST_BYTES', 5_000_000),
        'max_candidates' => (int) env('SIBYL_INGESTION_MAX_CANDIDATES', 100),
    ],
];
