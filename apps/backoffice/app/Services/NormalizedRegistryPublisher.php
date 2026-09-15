<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use RuntimeException;

final class NormalizedRegistryPublisher
{
    /** @return array{revision: string, files: int} */
    public function publish(string $path): array
    {
        if (! config('services.sibyl.publication_target') || ! config('services.sibyl.publication_authorized')) {
            throw new RuntimeException('Publication target and explicit authorization are required. No network call was made.');
        }
        $root = realpath($path);
        $exportRoot = realpath((string) config('sibyl.export_root'));
        if ($root === false || $exportRoot === false || ! str_starts_with($root.DIRECTORY_SEPARATOR, $exportRoot.DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Publication accepts only an existing local export under the configured export root.');
        }
        $indexPath = $root.'/data/v1/index.json';
        if (! is_file($indexPath)) {
            throw new RuntimeException('The reviewed export is missing data/v1/index.json.');
        }
        $indexBytes = file_get_contents($indexPath);
        $index = json_decode($indexBytes, true, 512, JSON_THROW_ON_ERROR);
        $revision = $index['revisionId'] ?? '';
        if (($index['schemaVersion'] ?? null) !== '2.0' || ! preg_match('/^sha256:[0-9a-f]{64}$/', $revision)) {
            throw new RuntimeException('The reviewed export has an invalid revision identity.');
        }
        $files = [$indexPath];
        $languageIds = [];
        foreach ($index['languages'] ?? [] as $language) {
            if (! isset($language['id'], $language['slug'], $language['path']) || $language['id'] !== $language['slug'] || $language['path'] !== "languages/{$language['slug']}.json" || isset($languageIds[$language['id']])) {
                throw new RuntimeException('The reviewed export has invalid or duplicate language references.');
            }
            $languageIds[$language['id']] = true;
            $file = $root.'/data/v1/'.$language['path'];
            if (! is_file($file)) {
                throw new RuntimeException('The reviewed export is missing a language artifact.');
            }
            $artifact = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            if (($artifact['schemaVersion'] ?? null) !== '2.0' || ($artifact['revisionId'] ?? null) !== $revision || ($artifact['language']['slug'] ?? null) !== $language['slug']) {
                throw new RuntimeException('The reviewed export contains an artifact with mismatched identity.');
            }
            $files[] = $file;
        }
        if (count($files) !== 26 || count($languageIds) !== 25) {
            throw new RuntimeException('The reviewed export must contain exactly one index and 25 language artifacts.');
        }
        $disk = Storage::disk('r2-public');
        foreach ($files as $file) {
            $relative = $revision.'/'.ltrim(str_replace($root.'/data/v1/', 'data/v1/', $file), '/');
            $bytes = file_get_contents($file);
            $disk->put($relative, $bytes);
            if ($disk->get($relative) !== $bytes) {
                throw new RuntimeException("Remote readback failed for {$relative}.");
            }
        }

        return ['revision' => $revision, 'files' => count($files)];
    }
}
