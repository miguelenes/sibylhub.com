<?php

namespace App\Services;

use App\Models\RegistryRevision;
use Illuminate\Filesystem\Filesystem;
use RuntimeException;

class RegistryExportService
{
    public function __construct(private readonly Filesystem $files) {}

    /** @return array{revision: string, path: string, payload: array} */
    public function export(?RegistryRevision $revision = null): array
    {
        $revision ??= RegistryRevision::query()->where('status', 'valid')->latest('id')->first();
        $payload = $revision ? $revision->payload : $this->loadBootstrapFixture();
        if (! is_array($payload)) {
            throw new RuntimeException('The selected registry revision has no export payload.');
        }
        $this->assertExportable($payload, $revision);

        $revisionId = $revision?->stable_id ?: (string) $payload['revisionId'];
        $payload['languages'] = collect($payload['languages'])->sortBy('id')->values()->all();
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n";
        $path = config('sibyl.export_root').'/'.$revisionId.'/ecosystem.json';
        $this->files->ensureDirectoryExists(dirname($path));
        $this->files->put($path, $json);

        return ['revision' => $revisionId, 'path' => $path, 'payload' => $payload];
    }

    private function loadBootstrapFixture(): array
    {
        $path = config('sibyl.schema_root').'/fixtures/valid-ecosystem.json';
        if (! $this->files->exists($path)) {
            throw new RuntimeException('The shared ecosystem fixture is missing; build packages/schemas first.');
        }

        $payload = json_decode($this->files->get($path), true, 512, JSON_THROW_ON_ERROR);

        return is_array($payload) ? $payload : throw new RuntimeException('The shared ecosystem fixture is not an object.');
    }

    private function assertExportable(array $payload, ?RegistryRevision $revision): void
    {
        if ($revision && ! $revision->isExportable()) {
            throw new RuntimeException('The selected registry revision is not exportable.');
        }
        if (($payload['schemaVersion'] ?? null) !== config('sibyl.schema_version')) {
            throw new RuntimeException('The registry schema version is unsupported.');
        }
        if (count($payload['languages'] ?? []) !== 25) {
            throw new RuntimeException('The registry must contain exactly 25 language identities.');
        }
        if (count(array_unique(array_column($payload['languages'], 'id'))) !== 25) {
            throw new RuntimeException('The registry language identities must be unique.');
        }

        $collections = [
            'runtimes' => 'runtimeId',
            'packageManagers' => 'packageManagerId',
            'lockfiles' => 'lockfileId',
            'builders' => 'builderId',
            'documentation' => 'documentationId',
            'invariants' => null,
        ];
        $ids = [];
        foreach ($collections as $collection => $relationship) {
            if (! is_array($payload[$collection] ?? null) || count($payload[$collection]) < 25) {
                throw new RuntimeException("The registry {$collection} collection is incomplete.");
            }
            $ids[$collection] = array_flip(array_filter(array_column($payload[$collection], 'id'), 'is_string'));
        }
        foreach ($payload['languages'] as $index => $language) {
            foreach ($collections as $collection => $relationship) {
                if ($relationship === null) {
                    continue;
                }
                $reference = $language[$relationship] ?? null;
                if (! is_string($reference) || ! isset($ids[$collection][$reference])) {
                    throw new RuntimeException("The registry relationship {$relationship} at language {$index} is unresolved.");
                }
            }
            foreach ($language['invariantIds'] ?? [] as $reference) {
                if (! is_string($reference) || ! isset($ids['invariants'][$reference])) {
                    throw new RuntimeException("The registry invariant relationship at language {$index} is unresolved.");
                }
            }
        }
        $serialized = strtolower(json_encode($payload, JSON_THROW_ON_ERROR));
        if (preg_match('/"(password|token|secret|authorization)"\s*:/', $serialized) === 1 || str_contains($serialized, 'private key')) {
            throw new RuntimeException('Secret-bearing registry content is not exportable.');
        }
    }
}
