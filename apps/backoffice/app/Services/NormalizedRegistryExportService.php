<?php

namespace App\Services;

use Illuminate\Filesystem\Filesystem;
use RuntimeException;

final class NormalizedRegistryExportService
{
    public function __construct(private readonly NormalizedRegistrySourceReader $reader, private readonly NormalizedRegistrySerializer $serializer, private readonly Filesystem $files) {}

    /** @return array{revision: string, path: string, files: list<string>} */
    public function export(): array
    {
        $artifacts = $this->serializer->serialize($this->reader->read());
        $this->validate($artifacts);
        $root = rtrim((string) config('sibyl.export_root'), '/').'/'.$artifacts['revisionId'].'/data/v1';
        $this->files->ensureDirectoryExists($root.'/languages');
        $written = [];
        $indexPath = $root.'/index.json';
        $this->files->put($indexPath, $this->json($artifacts['index']));
        $written[] = $indexPath;
        foreach ($artifacts['languages'] as $slug => $artifact) {
            $path = $root.'/languages/'.$slug.'.json';
            $this->files->put($path, $this->json($artifact));
            $written[] = $path;
        }

        return ['revision' => $artifacts['revisionId'], 'path' => dirname($root, 2), 'files' => $written];
    }

    private function validate(array $artifacts): void
    {
        if (! preg_match('/^sha256:[0-9a-f]{64}$/', $artifacts['revisionId'])) {
            throw new RuntimeException('Computed normalized revision identity is invalid.');
        }
        if (($artifacts['index']['schemaVersion'] ?? null) !== '2.0' || count($artifacts['languages']) !== 25) {
            throw new RuntimeException('The normalized split artifact is incomplete.');
        }
        $expected = array_keys($artifacts['languages']);
        sort($expected);
        $index = array_column($artifacts['index']['languages'], 'id');
        $actual = $index;
        sort($actual);
        if (count($index) !== 25 || $actual !== $expected) {
            throw new RuntimeException('The normalized split artifact must contain exactly the 25 target languages.');
        }
        $unsafe = false;
        $walk = function (mixed $value) use (&$walk, &$unsafe): void {
            if (is_array($value)) {
                foreach ($value as $key => $item) {
                    if (! is_array($item) && is_string($key) && in_array(strtolower($key), ['password', 'token', 'secret', 'authorization', 'exec', 'script', 'shell'], true)) {
                        $unsafe = true;
                    } $walk($item);
                }

                return;
            }
            if (is_string($value) && (str_contains(strtolower($value), 'private key') || preg_match('/-----begin [^-]+ private key-----/i', $value))) {
                $unsafe = true;
            }
        };
        $walk($artifacts);
        if ($unsafe) {
            throw new RuntimeException('Unsafe content is not exportable.');
        }
        foreach ($artifacts['languages'] as $slug => $artifact) {
            if ($artifact['revisionId'] !== $artifacts['revisionId'] || $artifact['language']['slug'] !== $slug) {
                throw new RuntimeException("Language artifact {$slug} has mismatched identity.");
            }
        }
    }

    private function json(array $value): string
    {
        return json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n";
    }
}
