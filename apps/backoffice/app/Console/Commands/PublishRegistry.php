<?php

namespace App\Console\Commands;

use App\Services\NormalizedRegistryPublisher;
use Illuminate\Console\Command;
use Throwable;

class PublishRegistry extends Command
{
    protected $signature = 'registry:publish {path : Local reviewed export path}';

    protected $description = 'Publish a reviewed normalized export to the explicitly authorized R2-compatible disk';

    public function handle(NormalizedRegistryPublisher $publisher): int
    {
        try {
            $result = $publisher->publish($this->argument('path'));
            $this->line(json_encode(['status' => 'published', ...$result], JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }
    }
}
