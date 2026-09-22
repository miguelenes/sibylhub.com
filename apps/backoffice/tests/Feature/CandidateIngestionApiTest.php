<?php

namespace Tests\Feature;

use App\Models\IngestionToken;
use App\Services\NormalizedRegistryExportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CandidateIngestionApiTest extends TestCase
{
    use RefreshDatabase;

    private string $token = 'test-ingestion-token';

    protected function setUp(): void
    {
        parent::setUp();
        config(['sibyl.ingestion.enabled' => true]);
        IngestionToken::create([
            'name' => 'test',
            'token_hash' => hash('sha256', $this->token),
            'scope' => 'packages:ingest',
        ]);
    }

    public function test_valid_batch_accepts_candidates_and_can_be_read_back(): void
    {
        $response = $this->authToken($this->token)->postJson('/api/v1/ingest/packages', $this->payload());

        $response->assertOk()->assertJsonPath('counts.accepted', 1);
        $response->assertJsonPath('outcomes.0.status', 'accepted');
        $this->getJson('/api/v1/ingest/packages/crawl-1')
            ->assertOk()
            ->assertJsonPath('batch.crawl_id', 'crawl-1')
            ->assertJsonPath('counts.accepted', 1);
    }

    public function test_mixed_batch_reports_per_candidate_rejection_and_replay_is_duplicate(): void
    {
        $payload = $this->payload();
        $payload['candidates'][] = array_merge($payload['candidates'][0], [
            'candidate_id' => 'pkg:npm/wrong@managed',
        ]);

        $this->authToken($this->token)->postJson('/api/v1/ingest/packages', $payload)
            ->assertOk()
            ->assertJsonPath('counts.accepted', 1)
            ->assertJsonPath('counts.rejected', 1);

        $this->authToken($this->token)->postJson('/api/v1/ingest/packages', $payload)
            ->assertOk()
            ->assertJsonPath('counts.duplicate', 1);
    }

    public function test_authentication_and_envelope_validation_happen_before_persistence(): void
    {
        $this->postJson('/api/v1/ingest/packages', $this->payload())->assertUnauthorized();
        IngestionToken::query()->update(['revoked_at' => now()]);
        $this->authToken($this->token)->postJson('/api/v1/ingest/packages', $this->payload())->assertUnauthorized();
        IngestionToken::query()->update(['revoked_at' => null]);
        $this->authToken($this->token)->postJson('/api/v1/ingest/packages', [
            'schema_version' => 'candidate-ingestion/1.0',
        ])->assertStatus(422);
        $this->assertDatabaseCount('ingestion_batches', 0);
    }

    public function test_staged_candidates_are_not_added_to_the_public_export(): void
    {
        $this->authToken($this->token)->postJson('/api/v1/ingest/packages', $this->payload())->assertOk();
        $export = app(NormalizedRegistryExportService::class)->export();

        $this->assertCount(26, $export['files']);
        $this->assertStringNotContainsString('pkg:npm/%40types/react@managed', file_get_contents($export['path'].'/data/v1/index.json'));
    }

    private function authToken(string $token): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    private function payload(): array
    {
        return [
            'artifact_kind' => 'candidate-ingestion',
            'schema_version' => 'candidate-ingestion/1.0',
            'crawl_id' => 'crawl-1',
            'artifact_content_identity' => 'sha256:'.str_repeat('c', 64),
            'candidates' => [[
                'candidate_id' => 'pkg:npm/%40types/react@managed',
                'ecosystem' => 'typescript',
                'purl' => [
                    'type' => 'npm',
                    'namespace' => '@types',
                    'name' => 'react',
                    'version' => 'managed',
                ],
                'name' => 'react',
                'namespace' => '@types',
                'evidence_ids' => ['evidence-npm-react'],
                'rank' => ['source_id' => 'npm', 'basis' => 'source-ranked', 'position' => 1],
                'detections' => [],
                'resolution' => ['status' => 'unresolved'],
            ]],
            'evidence' => [[
                'id' => 'evidence-npm-react',
                'source_id' => 'npm',
                'source_kind' => 'registry',
                'source_url' => 'https://registry.npmjs.org/react',
                'retrieved_at' => '2026-09-22T12:00:00.000Z',
                'content_hash' => 'sha256:'.str_repeat('a', 64),
                'evidence_type' => 'package-metadata',
            ]],
        ];
    }
}
