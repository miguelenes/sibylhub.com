<?php

namespace App\Services;

use App\Models\Builder;
use App\Models\Documentation;
use App\Models\DocumentationChunk;
use App\Models\LockfileSpecification;
use App\Models\Package;
use App\Models\PackageCategory;
use App\Models\PackageManager;
use App\Models\PackageRegistry;
use App\Models\ProgrammingLanguage;
use App\Models\Runtime;
use App\Models\StackInvariant;
use App\Models\WorkspaceConfiguration;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class NormalizedRegistryImportService
{
    public function import(array $registry): void
    {
        $diagnostics = [];
        if (($registry['index']['schemaVersion'] ?? null) !== '2.0') {
            $diagnostics[] = 'index.schemaVersion must be 2.0';
        }
        if (count($registry['languages'] ?? []) !== 25) {
            $diagnostics[] = 'languages must contain exactly 25 artifacts';
        }
        foreach ($registry['languages'] ?? [] as $position => $artifact) {
            foreach (['schemaVersion', 'revisionId', 'language'] as $field) {
                if (! array_key_exists($field, $artifact)) {
                    $diagnostics[] = "languages[{$position}].{$field} is required";
                }
            }
            if (! isset($artifact['language']['slug'], $artifact['language']['name'], $artifact['language']['purl'])) {
                $diagnostics[] = "languages[{$position}].language.slug, name, and purl are required";
            }
        }
        if ($diagnostics !== []) {
            throw new InvalidArgumentException('Normalized import validation failed: '.implode('; ', $diagnostics));
        }
        $expected = $this->expectedCounts($registry);
        DB::transaction(function () use ($registry, $expected): void {
            $languages = [];
            foreach ($registry['languages'] as $artifact) {
                $record = $artifact['language'];
                $languages[$record['slug']] = ProgrammingLanguage::query()->updateOrCreate(['slug' => $record['slug']], ['name' => $record['name'], 'extensions' => $record['extensions'], 'purl_type' => $record['purl']['type'], 'purl_namespace' => $record['purl']['namespace'] ?? null]);
            }
            $builders = [];
            foreach ($registry['index']['builders'] as $summary) {
                $detail = collect($registry['languages'])->flatMap(fn (array $artifact) => $artifact['builders'])->firstWhere('slug', $summary['slug']) ?? $summary;
                $builders[$summary['slug']] = Builder::query()->updateOrCreate(['slug' => $summary['slug']], ['name' => $detail['name'], 'configuration_files' => $detail['configurationFiles'] ?? [], 'run_command' => $detail['runCommand'] ?? '']);
            }
            foreach ($registry['languages'] as $artifact) {
                $language = $languages[$artifact['language']['slug']];
                $registries = [];
                foreach ($artifact['packageRegistries'] as $record) {
                    $registry = PackageRegistry::query()->updateOrCreate(['slug' => $record['slug']], ['name' => $record['name'], 'purl_type' => $record['purl']['type'], 'purl_namespace' => $record['purl']['namespace'] ?? null, 'homepage_url' => $record['homepageUrl'] ?? null, 'api_url' => $record['apiUrl'] ?? null, 'supports_namespaces' => $record['supportsNamespaces'] ?? false]);
                    $registries[$record['id']] = $registry;
                }
                $managers = [];
                foreach ($artifact['packageManagers'] as $record) {
                    $manager = PackageManager::query()->updateOrCreate(['slug' => $record['slug']], ['programming_language_id' => $language->id, 'package_registry_id' => isset($record['registryId']) ? ($registries[$record['registryId']] ?? null)?->id : null, 'name' => $record['name'], 'purl_type' => $record['purl']['type'], 'purl_namespace' => $record['purl']['namespace'] ?? null, 'binary' => $record['binary'], 'manifest_file' => $record['manifestFile'], 'lockfile_file' => $record['lockfileFile'] ?? null, 'install_command' => $record['installCommand'], 'add_command' => $record['addCommand']]);
                    $managers[$record['id']] = $manager;
                }
                foreach ($artifact['lockfileSpecifications'] as $record) {
                    LockfileSpecification::query()->updateOrCreate(['slug' => $record['slug']], ['package_manager_id' => $managers[$record['packageManagerId']]->id, 'name' => $record['name'], 'filename' => $record['filename'], 'format' => $record['format'], 'version_standard' => $record['versionStandard'], 'frozen_install' => $record['frozenInstall']]);
                }
                foreach ($artifact['workspaceConfigurations'] as $record) {
                    WorkspaceConfiguration::query()->updateOrCreate(['slug' => $record['slug']], ['package_manager_id' => $managers[$record['packageManagerId']]->id, 'name' => $record['name'], 'manifest' => $record['manifest'], 'format' => $record['format'], 'package_glob' => $record['packageGlob'], 'isolated_install' => $record['isolatedInstall']]);
                }
                $categories = [];
                foreach ($artifact['packageCategories'] as $record) {
                    $category = PackageCategory::query()->updateOrCreate(['slug' => $record['slug']], ['name' => $record['name'], 'description' => $record['description'] ?? null]);
                    $categories[$record['id']] = $category;
                }
                $packages = [];
                foreach ($artifact['packages'] as $record) {
                    $package = Package::query()->updateOrCreate(['package_manager_id' => $managers[$record['packageManagerId']]->id, 'slug' => $record['slug']], ['package_category_id' => $categories[$record['categoryId']]->id, 'name' => $record['name'], 'purl_type' => $record['purl']['type'], 'purl_namespace' => $record['purl']['namespace'] ?? null, 'homepage_url' => $record['homepageUrl'] ?? null, 'repository_url' => $record['repositoryUrl'] ?? null, 'license' => $record['license'] ?? null, 'opinionated' => $record['opinionated'], 'rationale' => $record['rationale'] ?? null]);
                    $packages[$record['id']] = $package;
                }
                $runtimes = [];
                foreach ($artifact['runtimes'] as $record) {
                    $runtime = Runtime::query()->updateOrCreate(['slug' => $record['slug']], ['programming_language_id' => $language->id, 'name' => $record['name'], 'engine_type' => $record['engineType'], 'version_manager' => $record['versionManager'] ?? null]);
                    $runtimes[$record['id']] = $runtime;
                }
                foreach ($artifact['compatibilities'] as $record) {
                    $package = $packages[$record['packageId']];
                    $runtime = $runtimes[$record['runtimeId']];
                    $package->runtimes()->syncWithoutDetaching([$runtime->id => ['compatible' => $record['compatible'], 'notes' => $record['notes'] ?? null]]);
                }
                foreach ($artifact['invariants'] as $record) {
                    StackInvariant::query()->updateOrCreate(['slug' => $record['slug']], ['package_category_id' => $categories[$record['categoryId']]->id, 'approved_package_id' => $packages[$record['approvedPackageId']]->id, 'banned_package_id' => $packages[$record['bannedPackageId']]->id, 'runtime_id' => isset($record['runtimeId']) ? $runtimes[$record['runtimeId']]->id : null, 'framework_package_id' => isset($record['frameworkPackageId']) ? $packages[$record['frameworkPackageId']]->id : null, 'name' => $record['name'], 'severity' => $record['severity'], 'reason' => $record['reason'], 'replacement_example' => $record['replacementExample'] ?? null, 'migration_url' => $record['migrationUrl'] ?? null]);
                }
                foreach ($artifact['builders'] as $record) {
                    if (isset($builders[$record['slug']])) {
                        $builders[$record['slug']]->programmingLanguages()->syncWithoutDetaching([$language->id]);
                    }
                }
                foreach ($artifact['documentations'] as $record) {
                    $documentation = Documentation::query()->updateOrCreate(['documentable_type' => ProgrammingLanguage::class, 'documentable_id' => $language->id], ['source_url' => $record['sourceUrl'] ?? null, 'r2_key' => $record['r2Key'] ?? null, 'content_hash' => $record['contentHash'], 'token_count' => $record['tokenCount']]);
                    foreach ($artifact['documentationChunks'] as $chunk) {
                        DocumentationChunk::query()->updateOrCreate(['documentation_id' => $documentation->id, 'ordinal' => $chunk['ordinal']], ['start_offset' => $chunk['startOffset'], 'end_offset' => $chunk['endOffset'], 'token_count' => $chunk['tokenCount'], 'summary' => $chunk['summary']]);
                    }
                }
            }
            foreach ($languages as $language) {
                $manager = $language->packageManagers()->orderBy('slug')->first();
                $language->update(['default_package_manager_id' => $manager?->id]);
            }

            $this->assertReadback($registry, $expected);
        });
    }

    /** @return array{languages: int, builders: int, packages: int, compatibilities: int, documentations: int} */
    private function expectedCounts(array $registry): array
    {
        return [
            'languages' => count($registry['languages']),
            'builders' => count($registry['index']['builders'] ?? []),
            'packages' => collect($registry['languages'])->sum(fn (array $artifact): int => count($artifact['packages'] ?? [])),
            'compatibilities' => collect($registry['languages'])->sum(fn (array $artifact): int => count($artifact['compatibilities'] ?? [])),
            'documentations' => collect($registry['languages'])->sum(fn (array $artifact): int => count($artifact['documentations'] ?? [])),
        ];
    }

    private function assertReadback(array $registry, array $expected): void
    {
        $expectedLanguageSlugs = collect($registry['languages'])->pluck('language.slug')->sort()->values()->all();
        $actualLanguageSlugs = ProgrammingLanguage::query()->orderBy('slug')->pluck('slug')->all();
        if ($actualLanguageSlugs !== $expectedLanguageSlugs || count($actualLanguageSlugs) !== $expected['languages']) {
            throw new InvalidArgumentException('Normalized import readback failed: language identity/count mismatch.');
        }
        $expectedBuilderSlugs = collect($registry['index']['builders'] ?? [])->pluck('slug')->sort()->values()->all();
        $actualBuilderSlugs = Builder::query()->orderBy('slug')->pluck('slug')->all();
        if ($actualBuilderSlugs !== $expectedBuilderSlugs || count($actualBuilderSlugs) !== $expected['builders']) {
            throw new InvalidArgumentException('Normalized import readback failed: builder identity/count mismatch.');
        }
        $expectedPackageKeys = collect($registry['languages'])->flatMap(function (array $artifact): array {
            $managers = collect($artifact['packageManagers'])->keyBy('id');

            return collect($artifact['packages'])->map(fn (array $package): string => $managers[$package['packageManagerId']]['slug'].':'.$package['slug'])->all();
        })->sort()->values()->all();
        $actualPackageKeys = Package::query()->with('packageManager')->get()->map(fn (Package $package): string => $package->packageManager->slug.':'.$package->slug)->sort()->values()->all();
        if ($actualPackageKeys !== $expectedPackageKeys || DB::table('package_runtime_compatibility')->count() !== $expected['compatibilities'] || Documentation::query()->count() !== $expected['documentations'] || ProgrammingLanguage::query()->whereNull('name')->exists()) {
            throw new InvalidArgumentException('Normalized import readback failed: relationship/count mismatch.');
        }
    }
}
