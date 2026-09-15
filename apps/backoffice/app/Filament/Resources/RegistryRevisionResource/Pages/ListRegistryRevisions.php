<?php

namespace App\Filament\Resources\RegistryRevisionResource\Pages;

use App\Filament\Resources\RegistryRevisionResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListRegistryRevisions extends ListRecords
{
    protected static string $resource = RegistryRevisionResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
