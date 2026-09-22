<?php

use App\Http\Controllers\CandidateIngestionController;
use Illuminate\Support\Facades\Route;

Route::middleware('ingestion.token')->group(function (): void {
    Route::post('/v1/ingest/packages', [CandidateIngestionController::class, 'store']);
    Route::get('/v1/ingest/packages/{crawlId}', [CandidateIngestionController::class, 'show']);
});
