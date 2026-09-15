<?php

namespace App\Filament\Resources;

use App\Filament\Resources\StackInvariantResource\Pages;
use App\Models\StackInvariant;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class StackInvariantResource extends Resource
{
    protected static ?string $model = StackInvariant::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-shield-check';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([Select::make('package_category_id')->relationship('packageCategory', 'name')->required(), Select::make('approved_package_id')->relationship('approvedPackage', 'name')->searchable()->required(), Select::make('banned_package_id')->relationship('bannedPackage', 'name')->searchable()->different('approved_package_id')->required(), Select::make('runtime_id')->relationship('runtime', 'name')->searchable(), Select::make('framework_package_id')->relationship('frameworkPackage', 'name')->searchable(), TextInput::make('slug')->required()->unique(ignoreRecord: true), TextInput::make('name')->required(), Select::make('severity')->options(['info' => 'Info', 'warning' => 'Warning', 'error' => 'Error', 'critical' => 'Critical'])->required(), TextInput::make('reason')->required()->columnSpanFull(), TextInput::make('replacement_example'), TextInput::make('migration_url')->url()]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('slug')->searchable(), TextColumn::make('name'), TextColumn::make('severity')->badge(), TextColumn::make('approvedPackage.name'), TextColumn::make('bannedPackage.name')])->defaultSort('slug');
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ListStackInvariants::route('/'), 'create' => Pages\CreateStackInvariant::route('/create'), 'edit' => Pages\EditStackInvariant::route('/{record}/edit')];
    }
}
