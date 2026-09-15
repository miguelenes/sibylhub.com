<?php

namespace App\Filament\Resources\ProgrammingLanguageResource\RelationManagers;

use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class PackageManagersRelationManager extends RelationManager
{
    protected static string $relationship = 'packageManagers';

    public function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('slug')->required(), TextInput::make('name')->required(), TextInput::make('purl_type')->required(), TextInput::make('binary')->required(), TextInput::make('manifest_file')->required(), TextInput::make('install_command')->required(), TextInput::make('add_command')->required()]);
    }

    public function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('slug'), TextColumn::make('name'), TextColumn::make('binary')]);
    }
}
