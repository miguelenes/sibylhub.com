<?php

namespace App\Console\Commands;

use App\Models\RegistryRevision;
use App\Services\RegistryExportService;
use Illuminate\Console\Command;
use Throwable;

class ExportPublicRegistry extends Command
{
    protected $signature = 'registry:export-public {--revision= : Stable revision identifier}';

    protected $description = 'Export a validated registry revision to the local R2-compatible tree';

    public function handle(RegistryExportService $exports): int
    {
        try {
            $revision = $this->option('revision')
                ? RegistryRevision::query()->where('stable_id', $this->option('revision'))->firstOrFail()
                : null;
            $result = $exports->export($revision);
            $this->line(json_encode([
                'status' => 'exported',
                'revision' => $result['revision'],
                'path' => $result['path'],
            ], JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }
    }
}
