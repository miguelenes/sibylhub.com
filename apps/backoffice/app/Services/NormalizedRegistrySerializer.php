<?php

namespace App\Services;

use App\Models\Builder;
use App\Models\Documentation;
use App\Models\Package;
use App\Models\PackageManager;
use App\Models\ProgrammingLanguage;
use App\Models\Runtime;
use App\Models\StackInvariant;
use Illuminate\Support\Collection;

final class NormalizedRegistrySerializer
{
    /** @param array{languages: Collection<int, ProgrammingLanguage>, builders: Collection<int, Builder>, documentations: Collection<int, Documentation>} $source */
    public function serialize(array $source): array
    {
        $graph = ['languages' => [], 'builders' => [], 'documentations' => []];
        foreach ($source['builders'] as $builder) {
            $graph['builders'][] = $this->builder($builder);
        }
        foreach ($source['documentations'] as $documentation) {
            $graph['documentations'][] = $this->documentation($documentation);
        }
        foreach ($source['languages'] as $language) {
            $graph['languages'][] = $this->languageGraph($language, $source['builders'], $source['documentations']);
        }
        $graph = $this->canonical($graph);
        $revisionId = 'sha256:'.hash('sha256', $this->json(['schemaVersion' => '2.0', 'graph' => $graph]));

        $index = ['schemaVersion' => '2.0', 'revisionId' => $revisionId, 'languages' => [], 'builders' => []];
        $artifacts = [];
        foreach ($graph['builders'] as $builder) {
            $index['builders'][] = ['id' => $builder['id'], 'slug' => $builder['slug'], 'name' => $builder['name']];
        }
        foreach ($graph['languages'] as $language) {
            $slug = $language['language']['slug'];
            $index['languages'][] = ['id' => $slug, 'slug' => $slug, 'name' => $language['language']['name'], 'path' => "languages/{$slug}.json"];
            $language['schemaVersion'] = '2.0';
            $language['revisionId'] = $revisionId;
            $artifacts[$slug] = $language;
        }
        $index = $this->canonical($index);
        foreach ($artifacts as &$artifact) {
            $artifact = $this->canonical($artifact);
        }
        unset($artifact);

        return ['revisionId' => $revisionId, 'index' => $index, 'languages' => $artifacts];
    }

    /** @return array<string, mixed> */
    private function languageGraph(ProgrammingLanguage $language, Collection $builders, Collection $documentations): array
    {
        $managers = $language->packageManagers;
        $packages = $managers->flatMap(fn (PackageManager $manager) => $manager->packages)->values();
        $runtimes = $language->runtimes;
        $categories = $packages->map(fn (Package $package) => $package->packageCategory)->filter()->unique('id')->values();
        $invariants = StackInvariant::query()->with(['packageCategory', 'approvedPackage', 'bannedPackage', 'runtime', 'frameworkPackage'])->where(function ($query) use ($runtimes): void {
            $query->whereNull('runtime_id')->orWhereIn('runtime_id', $runtimes->pluck('id'));
        })->orderBy('slug')->get();
        $docs = $documentations->filter(fn (Documentation $doc): bool => $doc->documentable_type === ProgrammingLanguage::class && (int) $doc->documentable_id === (int) $language->id);

        return [
            'language' => $this->language($language),
            'runtimes' => $runtimes->map(fn (Runtime $runtime) => $this->runtime($runtime))->all(),
            'packageRegistries' => $managers->map(fn (PackageManager $manager) => $manager->packageRegistry)->filter()->unique('id')->map(fn ($registry) => $this->registry($registry))->values()->all(),
            'packageManagers' => $managers->map(fn (PackageManager $manager) => $this->manager($manager))->all(),
            'lockfileSpecifications' => $managers->flatMap->lockfileSpecifications->map(fn ($value) => $this->lockfile($value))->values()->all(),
            'workspaceConfigurations' => $managers->flatMap->workspaceConfigurations->map(fn ($value) => $this->workspace($value))->values()->all(),
            'packageCategories' => $categories->map(fn ($value) => $this->category($value))->all(),
            'packages' => $packages->map(fn (Package $package) => $this->package($package))->all(),
            'compatibilities' => $packages->flatMap(fn (Package $package) => $package->runtimes->map(fn ($runtime) => ['id' => "compatibility-{$package->slug}-{$runtime->slug}", 'packageId' => "package-{$package->slug}", 'runtimeId' => "runtime-{$runtime->slug}", 'compatible' => (bool) $runtime->pivot->compatible, 'notes' => $runtime->pivot->notes]))->values()->all(),
            'builders' => $builders->filter(fn (Builder $builder) => $builder->programmingLanguages->contains('id', $language->id))->map(fn (Builder $builder) => $this->builder($builder))->values()->all(),
            'invariants' => $invariants->map(fn (StackInvariant $value) => $this->invariant($value))->all(),
            'documentations' => $docs->map(fn (Documentation $value) => $this->documentation($value))->values()->all(),
            'documentationChunks' => $docs->flatMap->chunks->map(fn ($value) => $this->chunk($value))->values()->all(),
        ];
    }

    private function purl(string $type, string $slug, ?string $namespace = null): array
    {
        return array_filter(['type' => $type, 'namespace' => $namespace, 'name' => $slug, 'version' => 'managed'], fn ($value) => $value !== null);
    }

    private function stable(string $id, string $slug, string $name, string $type = 'generic', ?string $namespace = null): array
    {
        return ['id' => $id, 'slug' => $slug, 'name' => $name, 'purl' => $this->purl($type, $slug, $namespace)];
    }

    private function language(ProgrammingLanguage $value): array
    {
        return array_merge($this->stable($value->slug, $value->slug, $value->name, $value->purl_type->value, $value->purl_namespace), ['extensions' => $value->extensions]);
    }

    private function runtime(Runtime $value): array
    {
        return array_merge($this->stable("runtime-{$value->slug}", $value->slug, $value->name), ['languageId' => $value->programmingLanguage->slug, 'engineType' => $value->engine_type->value, 'versionManager' => $value->version_manager]);
    }

    private function registry($value): array
    {
        return array_merge($this->stable("registry-{$value->slug}", $value->slug, $value->name, $value->purl_type->value, $value->purl_namespace), ['homepageUrl' => $value->homepage_url, 'apiUrl' => $value->api_url, 'supportsNamespaces' => (bool) $value->supports_namespaces]);
    }

    private function manager(PackageManager $value): array
    {
        return array_merge($this->stable("package-manager-{$value->slug}", $value->slug, $value->name, $value->purl_type->value, $value->purl_namespace), ['languageId' => $value->programmingLanguage->slug, 'registryId' => $value->packageRegistry?->slug ? "registry-{$value->packageRegistry->slug}" : null, 'binary' => $value->binary, 'manifestFile' => $value->manifest_file, 'lockfileFile' => $value->lockfile_file, 'installCommand' => $value->install_command, 'addCommand' => $value->add_command]);
    }

    private function lockfile($value): array
    {
        return array_merge($this->stable("lockfile-{$value->slug}", $value->slug, $value->name), ['packageManagerId' => "package-manager-{$value->packageManager->slug}", 'filename' => $value->filename, 'format' => $value->format->value, 'versionStandard' => $value->version_standard->value, 'frozenInstall' => (bool) $value->frozen_install]);
    }

    private function workspace($value): array
    {
        return array_merge($this->stable("workspace-{$value->slug}", $value->slug, $value->name), ['packageManagerId' => "package-manager-{$value->packageManager->slug}", 'manifest' => $value->manifest, 'format' => $value->format->value, 'packageGlob' => $value->package_glob, 'isolatedInstall' => (bool) $value->isolated_install]);
    }

    private function category($value): array
    {
        return ['id' => "category-{$value->slug}", 'slug' => $value->slug, 'name' => $value->name, 'description' => $value->description];
    }

    private function package(Package $value): array
    {
        return array_merge($this->stable("package-{$value->slug}", $value->slug, $value->name, $value->purl_type->value, $value->purl_namespace), ['packageManagerId' => "package-manager-{$value->packageManager->slug}", 'categoryId' => "category-{$value->packageCategory->slug}", 'homepageUrl' => $value->homepage_url, 'repositoryUrl' => $value->repository_url, 'license' => $value->license, 'opinionated' => (bool) $value->opinionated, 'rationale' => $value->rationale]);
    }

    private function builder(Builder $value): array
    {
        return array_merge($this->stable("builder-{$value->slug}", $value->slug, $value->name), ['configurationFiles' => $value->configuration_files, 'runCommand' => $value->run_command, 'languageIds' => $value->programmingLanguages->pluck('slug')->sort()->values()->all()]);
    }

    private function invariant(StackInvariant $value): array
    {
        return array_filter(['id' => "invariant-{$value->slug}", 'slug' => $value->slug, 'name' => $value->name, 'categoryId' => "category-{$value->packageCategory->slug}", 'approvedPackageId' => "package-{$value->approvedPackage->slug}", 'bannedPackageId' => "package-{$value->bannedPackage->slug}", 'runtimeId' => $value->runtime?->slug ? "runtime-{$value->runtime->slug}" : null, 'frameworkPackageId' => $value->frameworkPackage?->slug ? "package-{$value->frameworkPackage->slug}" : null, 'severity' => $value->severity->value, 'reason' => $value->reason, 'replacementExample' => $value->replacement_example, 'migrationUrl' => $value->migration_url], fn ($item) => $item !== null);
    }

    private function documentation(Documentation $value): array
    {
        return array_filter(['id' => "documentation-{$value->id}", 'documentableType' => $value->documentable_type, 'documentableId' => (string) $value->documentable_id, 'sourceUrl' => $value->source_url, 'r2Key' => $value->r2_key, 'contentHash' => $value->content_hash, 'tokenCount' => (int) $value->token_count, 'scrapedAt' => $value->scraped_at?->toISOString()], fn ($item) => $item !== null);
    }

    private function chunk($value): array
    {
        return ['id' => "documentation-chunk-{$value->id}", 'documentationId' => "documentation-{$value->documentation_id}", 'ordinal' => (int) $value->ordinal, 'startOffset' => (int) $value->start_offset, 'endOffset' => (int) $value->end_offset, 'tokenCount' => (int) $value->token_count, 'summary' => $value->summary];
    }

    private function json(array $value): string
    {
        return json_encode($this->canonical($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private function canonical(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        } if (array_is_list($value)) {
            foreach ($value as &$item) {
                $item = $this->canonical($item);
            } unset($item);
            usort($value, fn ($a, $b) => strcmp((string) ($a['id'] ?? $a['slug'] ?? $a['ordinal'] ?? ''), (string) ($b['id'] ?? $b['slug'] ?? $b['ordinal'] ?? '')));

            return array_values($value);
        } foreach ($value as $key => $item) {
            $value[$key] = $this->canonical($item);
        } ksort($value);

        return $value;
    }
}
