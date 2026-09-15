<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class PublishRegistry extends Command
{
    protected $signature = 'registry:publish {path : Local reviewed export path}';

    protected $description = 'Guarded placeholder for an explicitly authorized remote registry publication';

    public function handle(): int
    {
        if (! config('services.sibyl.publication_target') || ! env('SIBYL_PUBLICATION_AUTHORIZED')) {
            $this->components->error('Publication target and explicit authorization are required. No network call was made.');

            return self::FAILURE;
        }

        $this->components->error('Remote publication is intentionally outside the local bootstrap change.');

        return self::FAILURE;
    }
}
