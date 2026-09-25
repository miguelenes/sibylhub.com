<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CandidateStagingSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_candidate_staging_tables_support_scoped_batch_identity(): void
    {
        $batchId = DB::table('ingestion_batches')->insertGetId([
            'crawl_id' => 'crawl-1',
            'schema_version' => 'candidate-ingestion/1.0',
            'content_identity' => 'sha256:'.str_repeat('a', 64),
            'status' => 'received',
            'source_coverage' => '{}',
            'diagnostics' => '[]',
            'telemetry' => '{}',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $candidateId = DB::table('staged_candidates')->insertGetId([
            'ingestion_batch_id' => $batchId,
            'candidate_id' => 'pkg:npm/example@managed',
            'ecosystem' => 'javascript',
            'purl_type' => 'npm',
            'purl_namespace' => null,
            'purl_name' => 'example',
            'purl_version' => 'managed',
            'payload' => '{}',
            'status' => 'accepted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertDatabaseHas('staged_candidates', ['id' => $candidateId, 'ingestion_batch_id' => $batchId]);

        $this->expectException(QueryException::class);
        DB::table('staged_candidates')->insert([
            'ingestion_batch_id' => $batchId,
            'candidate_id' => 'pkg:npm/example@managed',
            'ecosystem' => 'javascript',
            'purl_type' => 'npm',
            'purl_name' => 'example',
            'purl_version' => 'managed',
            'payload' => '{}',
            'status' => 'accepted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
