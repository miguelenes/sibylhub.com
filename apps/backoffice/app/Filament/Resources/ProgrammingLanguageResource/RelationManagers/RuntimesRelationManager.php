<?php

namespace App\Filament\Resources\ProgrammingLanguageResource\RelationManagers;

use App\Enums\RuntimeEngineType;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class RuntimesRelationManager extends RelationManager
{
    protected static string $relationship = 'runtimes';

    public function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('slug')->required(), TextInput::make('name')->required(), Select::make('engine_type')->options(collect(RuntimeEngineType::cases())->mapWithKeys(fn (RuntimeEngineType $type): array => [$type->value => $type->value])->all())->required(), TextInput::make('version_manager')]);
    }

    public function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('slug'), TextColumn::make('name'), TextColumn::make('engine_type')]);
    }
}
