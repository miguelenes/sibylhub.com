<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\NormalizedRegistryImportService;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(NormalizedRegistryImportService $importer): void
    {
        User::query()->updateOrCreate(['email' => 'test@example.com'], ['name' => 'Test User', 'password' => bcrypt('password')]);
        $root = config('sibyl.schema_root').'/fixtures/valid-registry/data/v1';
        $indexPath = $root.'/index.json';
        if (! is_file($indexPath)) {
            throw new RuntimeException('The normalized registry fixture is missing; build packages/schemas first.');
        }
        $index = json_decode(file_get_contents($indexPath), true, 512, JSON_THROW_ON_ERROR);
        $languages = [];
        foreach ($index['languages'] as $summary) {
            $path = $root.'/'.$summary['path'];
            if (! is_file($path)) {
                throw new RuntimeException("Missing normalized language fixture: {$summary['path']}");
            } $languages[$summary['id']] = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        }
        $importer->import(['index' => $index, 'languages' => $languages]);
    }
}
