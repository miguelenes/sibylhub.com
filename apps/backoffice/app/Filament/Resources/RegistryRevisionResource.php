<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RegistryRevisionResource\Pages;
use App\Models\RegistryRevision;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class RegistryRevisionResource extends Resource
{
    protected static ?string $model = RegistryRevision::class;

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-rectangle-stack';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('stable_id')->required()->unique(ignoreRecord: true),
            TextInput::make('schema_version')->default('1.0')->required(),
            Select::make('status')->options([
                'draft' => 'Draft',
                'valid' => 'Valid',
                'rejected' => 'Rejected',
            ])->required(),
            Textarea::make('payload')
                ->required()
                ->rows(18)
                ->columnSpanFull()
                ->formatStateUsing(fn ($state): string => is_array($state) ? json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) : (string) $state)
                ->dehydrateStateUsing(fn ($state): array => is_string($state) ? json_decode($state, true, 512, JSON_THROW_ON_ERROR) : $state),
            Repeater::make('entries')
                ->relationship()
                ->schema([
                    TextInput::make('stable_id')->required(),
                    Select::make('kind')->options([
                        'language' => 'Language',
                        'runtime' => 'Runtime',
                        'package-manager' => 'Package manager',
                        'lockfile' => 'Lockfile',
                        'builder' => 'Builder',
                        'invariant' => 'Invariant',
                        'documentation' => 'Documentation',
                    ])->required(),
                    TextInput::make('name')->required(),
                ])
                ->columnSpanFull(),
            Repeater::make('relationships')
                ->relationship()
                ->schema([
                    Select::make('source_entry_id')
                        ->options(fn (?RegistryRevision $record): array => $record?->entries()->pluck('stable_id', 'id')->all() ?? [])
                        ->searchable()
                        ->required(),
                    Select::make('target_entry_id')
                        ->options(fn (?RegistryRevision $record): array => $record?->entries()->pluck('stable_id', 'id')->all() ?? [])
                        ->searchable()
                        ->required(),
                    TextInput::make('relationship')->required(),
                ])
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('stable_id')->searchable(),
            TextColumn::make('schema_version'),
            TextColumn::make('status')->badge(),
            TextColumn::make('updated_at')->dateTime(),
        ])->defaultSort('updated_at', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRegistryRevisions::route('/'),
            'create' => Pages\CreateRegistryRevision::route('/create'),
            'edit' => Pages\EditRegistryRevision::route('/{record}/edit'),
        ];
    }
}
