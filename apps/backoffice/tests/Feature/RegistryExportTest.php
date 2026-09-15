<?php

namespace Tests\Feature;

use App\Models\RegistryEntry;
use App\Models\RegistryEntryRelationship;
use App\Models\RegistryRevision;
use App\Services\RegistryExportService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class RegistryExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_route_returns_ready_json(): void
    {
        $this->getJson('/healthz')
            ->assertOk()
            ->assertJsonPath('status', 'ready');
    }

    public function test_admin_panel_has_an_explicit_auth_boundary(): void
    {
        $this->get('/admin')->assertStatus(302);
    }

    public function test_public_export_is_deterministic(): void
    {
        $service = app(RegistryExportService::class);
        $first = $service->export();
        $firstBytes = file_get_contents($first['path']);
        $second = $service->export();

        $this->assertSame($first['revision'], $second['revision']);
        $this->assertSame($firstBytes, file_get_contents($second['path']));
        $this->assertCount(25, $second['payload']['languages']);
    }

    public function test_incomplete_revision_cannot_be_exported(): void
    {
        $revision = RegistryRevision::query()->create([
            'stable_id' => 'invalid-revision',
            'schema_version' => '1.0',
            'status' => 'valid',
            'payload' => ['schemaVersion' => '1.0', 'languages' => []],
        ]);

        $this->expectException(RuntimeException::class);
        app(RegistryExportService::class)->export($revision);
    }

    public function test_registry_relationships_are_revision_scoped_and_unique(): void
    {
        $revision = RegistryRevision::query()->create([
            'stable_id' => 'relationship-revision',
            'schema_version' => '1.0',
            'status' => 'draft',
            'payload' => [],
        ]);
        $source = RegistryEntry::query()->create([
            'registry_revision_id' => $revision->id,
            'stable_id' => 'language:rust',
            'kind' => 'language',
            'name' => 'Rust',
            'metadata' => [],
        ]);
        $target = RegistryEntry::query()->create([
            'registry_revision_id' => $revision->id,
            'stable_id' => 'runtime:rust',
            'kind' => 'runtime',
            'name' => 'Rust',
            'metadata' => [],
        ]);

        $relationship = RegistryEntryRelationship::query()->create([
            'registry_revision_id' => $revision->id,
            'source_entry_id' => $source->id,
            'target_entry_id' => $target->id,
            'relationship' => 'uses-runtime',
        ]);

        $this->assertTrue($source->outgoingRelationships()->whereKey($relationship->id)->exists());
        $this->assertSame($revision->id, $relationship->revision->id);
        $this->expectException(QueryException::class);
        RegistryEntryRelationship::query()->create([
            'registry_revision_id' => $revision->id,
            'source_entry_id' => $source->id,
            'target_entry_id' => $target->id,
            'relationship' => 'uses-runtime',
        ]);
    }

    public function test_unresolved_relationships_and_secret_content_are_rejected(): void
    {
        $payload = json_decode(
            file_get_contents(base_path('../../packages/schemas/fixtures/valid-ecosystem.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $payload['languages'][0]['runtime'] = 'runtime:missing';
        $payload['metadata'] = ['token' => 'secret'];

        $revision = RegistryRevision::query()->create([
            'stable_id' => 'unsafe-revision',
            'schema_version' => '1.0',
            'status' => 'valid',
            'payload' => $payload,
        ]);

        $this->expectException(RuntimeException::class);
        app(RegistryExportService::class)->export($revision);
    }
}
