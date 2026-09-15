<?php

namespace App\Filament\Resources;

use App\Enums\RegistryPurlType;
use App\Filament\Resources\ProgrammingLanguageResource\Pages;
use App\Models\ProgrammingLanguage;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ProgrammingLanguageResource extends Resource
{
    protected static ?string $model = ProgrammingLanguage::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-code-bracket';

    public static function getRelations(): array
    {
        return [ProgrammingLanguageResource\RelationManagers\RuntimesRelationManager::class, ProgrammingLanguageResource\RelationManagers\PackageManagersRelationManager::class];
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('slug')->required()->unique(ignoreRecord: true), TextInput::make('name')->required(), TextInput::make('extensions')->helperText('JSON array of source extensions')->required(), Select::make('purl_type')->options(collect(RegistryPurlType::cases())->mapWithKeys(fn (RegistryPurlType $type): array => [$type->value => $type->value])->all())->required(), TextInput::make('purl_namespace')]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('slug')->searchable(), TextColumn::make('name')->searchable(), TextColumn::make('purl_type'), TextColumn::make('updated_at')->dateTime()])->defaultSort('slug');
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ListProgrammingLanguages::route('/'), 'create' => Pages\CreateProgrammingLanguage::route('/create'), 'edit' => Pages\EditProgrammingLanguage::route('/{record}/edit')];
    }
}
