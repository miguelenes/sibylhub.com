<?php

namespace App\Filament\Resources;

use App\Enums\RegistryPurlType;
use App\Filament\Resources\PackageManagerResource\Pages;
use App\Models\PackageManager;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class PackageManagerResource extends Resource
{
    protected static ?string $model = PackageManager::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-wrench-screwdriver';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([Select::make('programming_language_id')->relationship('programmingLanguage', 'name')->searchable()->required(), Select::make('package_registry_id')->relationship('packageRegistry', 'name')->searchable(), TextInput::make('slug')->required()->unique(ignoreRecord: true), TextInput::make('name')->required(), Select::make('purl_type')->options(collect(RegistryPurlType::cases())->mapWithKeys(fn (RegistryPurlType $type): array => [$type->value => $type->value])->all())->required(), TextInput::make('binary')->required(), TextInput::make('manifest_file')->required(), TextInput::make('lockfile_file'), TextInput::make('install_command')->required(), TextInput::make('add_command')->required()]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('slug')->searchable(), TextColumn::make('name'), TextColumn::make('programmingLanguage.name')->label('Language'), TextColumn::make('packageRegistry.name')->label('Registry')])->defaultSort('slug');
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ListPackageManagers::route('/'), 'create' => Pages\CreatePackageManager::route('/create'), 'edit' => Pages\EditPackageManager::route('/{record}/edit')];
    }
}
