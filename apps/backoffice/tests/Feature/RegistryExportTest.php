<?php

namespace Tests\Feature;

use App\Models\StackInvariant;
use App\Services\NormalizedRegistryExportService;
use App\Services\NormalizedRegistryPublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class RegistryExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_export_is_deterministic_and_split_into_the_complete_catalog(): void
    {
        $service = app(NormalizedRegistryExportService::class);
        $first = $service->export();
        $second = $service->export();

        $this->assertSame($first['revision'], $second['revision']);
        $this->assertSame($first['path'], $second['path']);
        $this->assertFileExists($first['path'].'/data/v1/index.json');
        $this->assertCount(26, $first['files']);
        $this->assertCount(25, glob($first['path'].'/data/v1/languages/*.json'));
        $this->assertMatchesRegularExpression('/^sha256:[0-9a-f]{64}$/', $first['revision']);
        $this->assertSame(file_get_contents($first['path'].'/data/v1/index.json'), file_get_contents($second['path'].'/data/v1/index.json'));
    }

    public function test_export_requires_a_complete_normalized_source(): void
    {
        foreach (['documentation_chunks', 'documentations', 'builder_language', 'stack_invariants', 'package_runtime_compatibility', 'packages', 'package_categories', 'workspace_configurations', 'lockfile_specifications', 'package_managers', 'package_registries', 'runtimes', 'programming_languages', 'builders'] as $table) {
            DB::table($table)->delete();
        }

        $this->expectException(RuntimeException::class);
        app(NormalizedRegistryExportService::class)->export();
    }

    public function test_stack_invariant_rejects_equal_approved_and_banned_packages(): void
    {
        $invariant = StackInvariant::query()->firstOrFail();

        $this->expectException(\InvalidArgumentException::class);
        $invariant->update(['banned_package_id' => $invariant->approved_package_id]);
    }

    public function test_authorized_publisher_uploads_and_reads_back_the_complete_tree(): void
    {
        $export = app(NormalizedRegistryExportService::class)->export();
        config(['services.sibyl.publication_target' => 'r2-test', 'services.sibyl.publication_authorized' => true]);
        Storage::fake('r2-public');

        $result = app(NormalizedRegistryPublisher::class)->publish($export['path']);

        $this->assertSame(26, $result['files']);
        Storage::disk('r2-public')->assertExists($result['revision'].'/data/v1/index.json');
    }

    public function test_publisher_requires_authorization_before_opening_the_remote_disk(): void
    {
        $export = app(NormalizedRegistryExportService::class)->export();
        config(['services.sibyl.publication_target' => null, 'services.sibyl.publication_authorized' => false]);

        $this->expectException(RuntimeException::class);
        app(NormalizedRegistryPublisher::class)->publish($export['path']);
    }
}
