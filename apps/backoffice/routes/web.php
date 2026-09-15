<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/healthz', fn () => response()->json([
    'status' => 'ready',
    'schemaVersion' => config('sibyl.schema_version'),
]));
