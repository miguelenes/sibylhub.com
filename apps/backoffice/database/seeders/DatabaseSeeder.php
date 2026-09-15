<?php

namespace Database\Seeders;

use App\Models\RegistryEntry;
use App\Models\RegistryEntryRelationship;
use App\Models\RegistryRevision;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        $path = config('sibyl.schema_root').'/fixtures/valid-ecosystem.json';
        if (! is_file($path)) {
            throw new RuntimeException('The committed ecosystem fixture is missing; build packages/schemas first.');
        }
        $payload = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $revision = RegistryRevision::query()->updateOrCreate(
            ['stable_id' => $payload['revisionId']],
            [
                'schema_version' => $payload['schemaVersion'],
                'status' => 'valid',
                'payload' => $payload,
            ],
        );

        $revision->relationships()->delete();
        $revision->entries()->delete();
        $entries = [];
        foreach ([
            'languages', 'runtimes', 'packageManagers', 'lockfiles', 'builders', 'invariants', 'documentation',
        ] as $collection) {
            foreach ($payload[$collection] as $entry) {
                $kind = rtrim($collection, 's');
                $record = RegistryEntry::query()->create([
                    'registry_revision_id' => $revision->id,
                    'stable_id' => $collection.':'.$entry['id'],
                    'kind' => $kind,
                    'name' => $entry['name'] ?? $entry['title'],
                    'metadata' => $entry,
                ]);
                $entries[$collection.'.'.$entry['id']] = $record;
            }
        }
        foreach ($payload['languages'] as $language) {
            foreach ([
                'runtimeId' => 'runtimes',
                'packageManagerId' => 'packageManagers',
                'lockfileId' => 'lockfiles',
                'builderId' => 'builders',
                'documentationId' => 'documentation',
            ] as $field => $collection) {
                RegistryEntryRelationship::query()->create([
                    'registry_revision_id' => $revision->id,
                    'source_entry_id' => $entries['languages.'.$language['id']]->id,
                    'target_entry_id' => $entries[$collection.'.'.$language[$field]]->id,
                    'relationship' => $field,
                ]);
            }
            foreach ($language['invariantIds'] as $invariantId) {
                RegistryEntryRelationship::query()->create([
                    'registry_revision_id' => $revision->id,
                    'source_entry_id' => $entries['languages.'.$language['id']]->id,
                    'target_entry_id' => $entries['invariants.'.$invariantId]->id,
                    'relationship' => 'invariantId',
                ]);
            }
        }
    }
}
