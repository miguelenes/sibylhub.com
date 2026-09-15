<?php

return [
    'schema_version' => env('SIBYL_SCHEMA_VERSION', '1.0'),
    'schema_root' => dirname(base_path(), 2).'/packages/schemas',
    'export_root' => storage_path('app/exports/registry'),
];
