<?php

use App\Enums\RegistryPurlType;
use App\Enums\RuntimeEngineType;
use App\Models\Package;
use App\Models\PackageCategory;
use App\Models\PackageManager;
use App\Models\ProgrammingLanguage;
use App\Models\Runtime;
use App\Models\StackInvariant;
use App\Services\NormalizedRegistryExportService;
use App\Services\NormalizedRegistryImportService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

test('the normalized catalog contains all 25 language identities', function (): void {
    expect(ProgrammingLanguage::query()->count())->toBe(25);
});

test('the local export does not require the remote publication disk', function (): void {
    $result = app(NormalizedRegistryExportService::class)->export();

    expect($result['files'])->toHaveCount(26);
});

test('the normalized migration exposes every source table', function (): void {
    $tables = collect(Schema::getTables())->map(fn (array|string $table): string => is_array($table) ? $table['name'] : $table)->all();
    expect($tables)->toContain(...[
        'users', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'sessions',
        'legacy_registry_revisions', 'legacy_registry_entries', 'legacy_registry_entry_relationships',
        'programming_languages', 'runtimes', 'package_registries', 'package_managers',
        'lockfile_specifications', 'workspace_configurations', 'package_categories', 'packages',
        'package_runtime_compatibility', 'stack_invariants', 'builders', 'builder_language',
        'documentations', 'documentation_chunks',
    ]);
});

test('package slugs are unique within a manager', function (): void {
    $package = Package::query()->firstOrFail();

    expect(fn () => Package::query()->create($package->only([
        'package_manager_id', 'slug', 'package_category_id', 'name', 'purl_type', 'opinionated',
    ])))->toThrow(QueryException::class);
});

test('required package categories cannot be deleted while packages reference them', function (): void {
    expect(fn () => PackageCategory::query()->firstOrFail()->delete())->toThrow(QueryException::class);
});

test('invariants may be global or runtime scoped', function (): void {
    $global = StackInvariant::query()->whereNull('runtime_id')->firstOrFail();
    $runtime = Runtime::query()->firstOrFail();
    StackInvariant::query()->create([...$global->only(['package_category_id', 'approved_package_id', 'banned_package_id', 'name', 'severity', 'reason']), 'slug' => 'runtime-scoped-test', 'runtime_id' => $runtime->id]);

    expect($global->runtime_id)->toBeNull()
        ->and(StackInvariant::query()->where('slug', 'runtime-scoped-test')->value('runtime_id'))->toBe($runtime->id);
});

test('malformed imports report fields before changing normalized state', function (): void {
    $index = json_decode(file_get_contents(base_path('../../packages/schemas/fixtures/valid-registry/data/v1/index.json')), true, 512, JSON_THROW_ON_ERROR);
    $registry = ['index' => $index, 'languages' => []];
    $registry['languages'] = [];
    foreach ($registry['index']['languages'] as $language) {
        $artifact = json_decode(file_get_contents(base_path('../../packages/schemas/fixtures/valid-registry/data/v1/'.$language['path'])), true, 512, JSON_THROW_ON_ERROR);
        $registry['languages'][] = $artifact;
    }
    unset($registry['languages'][0]['language']['slug']);

    expect(fn () => app(NormalizedRegistryImportService::class)->import($registry))
        ->toThrow(InvalidArgumentException::class, 'language.slug');
    expect(ProgrammingLanguage::query()->count())->toBe(25);
});

test('the complete fixture imports with stable readback and enum casts', function (): void {
    $index = json_decode(file_get_contents(base_path('../../packages/schemas/fixtures/valid-registry/data/v1/index.json')), true, 512, JSON_THROW_ON_ERROR);
    $registry = ['index' => $index, 'languages' => []];
    foreach ($index['languages'] as $language) {
        $registry['languages'][] = json_decode(file_get_contents(base_path('../../packages/schemas/fixtures/valid-registry/data/v1/'.$language['path'])), true, 512, JSON_THROW_ON_ERROR);
    }

    app(NormalizedRegistryImportService::class)->import($registry);

    expect(Runtime::query()->firstOrFail()->engine_type)->toBeInstanceOf(RuntimeEngineType::class)
        ->and(PackageManager::query()->firstOrFail()->purl_type)->toBeInstanceOf(RegistryPurlType::class)
        ->and(ProgrammingLanguage::query()->count())->toBe(25);
});
