<?php

namespace App\Console\Commands;

use App\Services\NormalizedRegistryExportService;
use Illuminate\Console\Command;
use Throwable;

class ExportPublicRegistry extends Command
{
    protected $signature = 'registry:export-public';

    protected $description = 'Export the normalized registry to the local revision-scoped tree';

    public function handle(NormalizedRegistryExportService $exports): int
    {
        try {
            $result = $exports->export();
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
