<?php

namespace App\Filament\Resources;

use App\Enums\RegistryPurlType;
use App\Filament\Resources\PackageResource\Pages;
use App\Models\Package;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class PackageResource extends Resource
{
    protected static ?string $model = Package::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-cube';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([Select::make('package_manager_id')->relationship('packageManager', 'name')->searchable()->required(), Select::make('package_category_id')->relationship('packageCategory', 'name')->searchable()->required(), TextInput::make('slug')->required(), TextInput::make('name')->required(), Select::make('purl_type')->options(collect(RegistryPurlType::cases())->mapWithKeys(fn (RegistryPurlType $type): array => [$type->value => $type->value])->all())->required(), TextInput::make('purl_namespace'), TextInput::make('homepage_url')->url(), TextInput::make('repository_url')->url(), TextInput::make('license'), Toggle::make('opinionated'), TextInput::make('rationale')->columnSpanFull()]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('slug')->searchable(), TextColumn::make('name'), TextColumn::make('packageManager.name')->label('Manager'), TextColumn::make('packageCategory.name')->label('Category'), IconColumn::make('opinionated')->boolean()])->defaultSort('slug');
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ListPackages::route('/'), 'create' => Pages\CreatePackage::route('/create'), 'edit' => Pages\EditPackage::route('/{record}/edit')];
    }
}
