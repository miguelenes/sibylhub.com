<?php

namespace Tests\Feature;

use App\Models\Package;
use App\Models\PackageCategory;
use App\Models\PackageManager;
use App\Models\StagedCandidate;
use App\Services\CandidateReviewImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CandidateReviewImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_review_requires_explicit_resolution_and_preserves_administrator_choice(): void
    {
        $staged = $this->stageCandidate();
        $service = app(CandidateReviewImportService::class);
        $this->expectException(\InvalidArgumentException::class);
        $service->approve($staged, []);
    }

    public function test_review_imports_only_after_relationships_and_opinion_are_supplied(): void
    {
        $staged = $this->stageCandidate();
        $manager = PackageManager::query()->firstOrFail();
        $category = PackageCategory::query()->firstOrFail();

        $package = app(CandidateReviewImportService::class)->approve($staged, [
            'package_manager_id' => $manager->id,
            'package_category_id' => $category->id,
            'slug' => 'reviewed-react',
            'opinionated' => true,
            'rationale' => 'Approved by an administrator after evidence review.',
        ]);

        $this->assertInstanceOf(Package::class, $package);
        $this->assertTrue($package->opinionated);
        $this->assertDatabaseHas('packages', ['id' => $package->id, 'slug' => 'reviewed-react']);
    }

    private function stageCandidate(): StagedCandidate
    {
        $batchId = DB::table('ingestion_batches')->insertGetId([
            'crawl_id' => 'crawl-review',
            'schema_version' => 'candidate-ingestion/1.0',
            'content_identity' => 'sha256:'.str_repeat('d', 64),
            'status' => 'processed',
            'source_coverage' => '[]',
            'diagnostics' => '[]',
            'telemetry' => '{}',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return StagedCandidate::create([
            'ingestion_batch_id' => $batchId,
            'candidate_id' => 'pkg:npm/%40types/react@managed',
            'ecosystem' => 'typescript',
            'purl_type' => 'npm',
            'purl_namespace' => '@types',
            'purl_name' => 'react',
            'purl_version' => 'managed',
            'payload' => [
                'candidateId' => 'pkg:npm/%40types/react@managed',
                'name' => 'react',
                'purl' => ['type' => 'npm', 'namespace' => '@types', 'name' => 'react', 'version' => 'managed'],
                'repositoryUrl' => 'https://github.com/facebook/react',
                'license' => 'MIT',
                'observations' => [],
            ],
            'status' => 'accepted',
        ]);
    }
}
