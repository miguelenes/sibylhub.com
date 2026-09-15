<?php

namespace App\Services;

use App\Models\Builder;
use App\Models\Documentation;
use App\Models\ProgrammingLanguage;
use Illuminate\Support\Collection;
use RuntimeException;

final class NormalizedRegistrySourceReader
{
    /** @return array{languages: Collection<int, ProgrammingLanguage>, builders: Collection<int, Builder>, documentations: Collection<int, Documentation>} */
    public function read(): array
    {
        $languages = ProgrammingLanguage::query()->with([
            'runtimes.packages',
            'packageManagers.packageRegistry',
            'packageManagers.lockfileSpecifications',
            'packageManagers.workspaceConfigurations',
            'packageManagers.packages.packageCategory',
            'packageManagers.packages.runtimes',
            'builders',
        ])->orderBy('slug')->get();
        if ($languages->count() !== 25) {
            throw new RuntimeException('A complete normalized catalog requires exactly 25 programming languages.');
        }
        if ($languages->pluck('slug')->unique()->count() !== 25) {
            throw new RuntimeException('Normalized language slugs must be unique.');
        }
        $builders = Builder::query()->with('programmingLanguages')->orderBy('slug')->get();
        if ($builders->isEmpty()) {
            throw new RuntimeException('At least one normalized builder is required.');
        }
        $documentations = Documentation::query()->with('chunks')->orderBy('id')->get();

        return compact('languages', 'builders', 'documentations');
    }
}
