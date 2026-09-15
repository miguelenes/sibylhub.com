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
        if (! $revision) {
            throw new RuntimeException('A validated registry revision is required for export.');
        }
        $payload = $revision->payload;
        if (! is_array($payload)) {
            throw new RuntimeException('The selected registry revision has no export payload.');
        }
        $this->assertExportable($payload, $revision);
        $this->assertRelationalIntegrity($revision, $payload);
        $payload = $this->canonicalize($payload);

        $revisionId = $revision->stable_id;
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n";
        $path = config('sibyl.export_root').'/'.$revisionId.'/ecosystem.json';
        $this->files->ensureDirectoryExists(dirname($path));
        $this->files->put($path, $json);

        return ['revision' => $revisionId, 'path' => $path, 'payload' => $payload];
    }

    private function assertExportable(array $payload, RegistryRevision $revision): void
    {
        if (! $revision->isExportable()) {
            throw new RuntimeException('The selected registry revision is not exportable.');
        }
        if (($payload['schemaVersion'] ?? null) !== config('sibyl.schema_version')) {
            throw new RuntimeException('The registry schema version is unsupported.');
        }
        if (($payload['revisionId'] ?? null) !== $revision->stable_id) {
            throw new RuntimeException('The registry payload revision identity does not match the revision record.');
        }
        $expected = ['languages', 'runtimes', 'packageManagers', 'lockfiles', 'builders', 'invariants', 'documentation'];
        foreach ($expected as $collection) {
            if (! is_array($payload[$collection] ?? null) || count($payload[$collection]) !== 25) {
                throw new RuntimeException("The registry {$collection} collection must contain exactly 25 entries.");
            }
            $ids = array_column($payload[$collection], 'id');
            if (count(array_unique($ids)) !== 25 || count(array_filter($ids, 'is_string')) !== 25) {
                throw new RuntimeException("The registry {$collection} identifiers must be unique.");
            }
        }
        $expectedLanguageIds = $this->expectedLanguageIds();
        $languageIds = array_column($payload['languages'], 'id');
        sort($languageIds);
        if ($languageIds !== $expectedLanguageIds) {
            throw new RuntimeException('The registry language vocabulary is incomplete or unsupported.');
        }
        foreach (['languages', 'runtimes', 'packageManagers', 'lockfiles', 'builders'] as $collection) {
            foreach ($payload[$collection] as $entry) {
                $this->assertPurl($entry['purl'] ?? null);
            }
        }
        foreach ($payload['languages'] as $index => $language) {
            foreach (['runtimeId', 'packageManagerId', 'lockfileId', 'builderId', 'documentationId'] as $field) {
                if (! is_string($language[$field] ?? null) || ! $this->containsId($payload[$this->collectionFor($field)], $language[$field])) {
                    throw new RuntimeException("The registry relationship {$field} at language {$index} is unresolved.");
                }
            }
            if (! is_array($language['invariantIds'] ?? null) || $language['invariantIds'] === []) {
                throw new RuntimeException("The registry invariant relationship at language {$index} is missing.");
            }
            foreach ($language['invariantIds'] as $reference) {
                if (! is_string($reference) || ! $this->containsId($payload['invariants'], $reference)) {
                    throw new RuntimeException("The registry invariant relationship at language {$index} is unresolved.");
                }
            }
        }
        foreach ($payload['invariants'] as $invariant) {
            if (! is_string($invariant['languageId'] ?? null) || ! $this->containsId($payload['languages'], $invariant['languageId'])) {
                throw new RuntimeException('The registry invariant language relationship is unresolved.');
            }
            if (! is_array($invariant['evidenceFields'] ?? null) || $invariant['evidenceFields'] === []) {
                throw new RuntimeException('The registry invariant evidence fields are missing.');
            }
        }
        $serialized = strtolower(json_encode($payload, JSON_THROW_ON_ERROR));
        if (preg_match('/"(password|token|secret|authorization)"\s*:/', $serialized) === 1 || str_contains($serialized, 'private key')) {
            throw new RuntimeException('Secret-bearing registry content is not exportable.');
        }
    }

    private function assertRelationalIntegrity(RegistryRevision $revision, array $payload): void
    {
        $entries = $revision->entries()->get()->keyBy('stable_id');
        foreach (['languages', 'runtimes', 'packageManagers', 'lockfiles', 'builders', 'invariants', 'documentation'] as $collection) {
            foreach ($payload[$collection] as $entry) {
                $record = $entries->get($collection.':'.$entry['id']);
                if (! $record || $record->registry_revision_id !== $revision->id) {
                    throw new RuntimeException('The registry relational entries do not match the payload.');
                }
            }
        }
        $relationships = $revision->relationships()->with(['source', 'target'])->get();
        foreach ($payload['languages'] as $language) {
            $source = $entries->get('languages:'.$language['id']);
            foreach (['runtimeId' => 'runtimes', 'packageManagerId' => 'packageManagers', 'lockfileId' => 'lockfiles', 'builderId' => 'builders', 'documentationId' => 'documentation'] as $field => $collection) {
                $target = $entries->get($collection.':'.$language[$field]);
                if (! $relationships->contains(fn ($relationship) => $relationship->source_entry_id === $source->id && $relationship->target_entry_id === $target->id && $relationship->relationship === $field)) {
                    throw new RuntimeException('The registry relational relationships do not match the payload.');
                }
            }
            foreach ($language['invariantIds'] as $invariantId) {
                $target = $entries->get('invariants:'.$invariantId);
                if (! $relationships->contains(fn ($relationship) => $relationship->source_entry_id === $source->id && $relationship->target_entry_id === $target->id && $relationship->relationship === 'invariantId')) {
                    throw new RuntimeException('The registry invariant relationships do not match the payload.');
                }
            }
        }
    }

    private function containsId(array $entries, string $id): bool
    {
        return in_array($id, array_column($entries, 'id'), true);
    }

    /** @return list<string> */
    private function expectedLanguageIds(): array
    {
        $fixture = config('sibyl.schema_root').'/fixtures/valid-ecosystem.json';
        if (! is_file($fixture)) {
            throw new RuntimeException('The shared ecosystem fixture is missing.');
        }
        $document = json_decode(file_get_contents($fixture), true, 512, JSON_THROW_ON_ERROR);
        $ids = array_column($document['languages'] ?? [], 'id');
        sort($ids);

        return $ids;
    }

    private function assertPurl(mixed $purl): void
    {
        if (! is_array($purl) || ! is_string($purl['type'] ?? null) || ! is_string($purl['name'] ?? null) || ! is_string($purl['version'] ?? null)) {
            throw new RuntimeException('Every catalog entry must contain a complete PURL.');
        }
        if (preg_match('/\s/', $purl['type']) === 1 || preg_match('/\s/', $purl['name']) === 1 || preg_match('/\s/', $purl['version']) === 1) {
            throw new RuntimeException('Catalog PURLs must not contain whitespace.');
        }
    }

    private function collectionFor(string $field): string
    {
        return ['runtimeId' => 'runtimes', 'packageManagerId' => 'packageManagers', 'lockfileId' => 'lockfiles', 'builderId' => 'builders', 'documentationId' => 'documentation'][$field];
    }

    private function canonicalize(array $payload): array
    {
        foreach (['languages', 'runtimes', 'packageManagers', 'lockfiles', 'builders', 'invariants', 'documentation'] as $collection) {
            usort($payload[$collection], fn (array $left, array $right): int => strcmp((string) $left['id'], (string) $right['id']));
        }
        foreach ($payload['languages'] as &$language) {
            sort($language['invariantIds']);
            if (isset($language['purl']['qualifiers']) && is_array($language['purl']['qualifiers'])) {
                ksort($language['purl']['qualifiers']);
            }
        }
        unset($language);
        foreach ($payload['invariants'] as &$invariant) {
            sort($invariant['evidenceFields']);
        }
        unset($invariant);
        $this->sortObjectKeys($payload);

        return $payload;
    }

    private function sortObjectKeys(array &$value): void
    {
        foreach ($value as &$item) {
            if (is_array($item)) {
                $this->sortObjectKeys($item);
            }
        }
        unset($item);
        ksort($value);
    }
}
