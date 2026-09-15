<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RegistryRevision extends Model
{
    use HasFactory;

    protected $fillable = ['stable_id', 'schema_version', 'status', 'payload', 'published_at'];

    protected function casts(): array
    {
        return ['payload' => 'array', 'published_at' => 'datetime'];
    }

    public function entries(): HasMany
    {
        return $this->hasMany(RegistryEntry::class);
    }

    public function relationships(): HasMany
    {
        return $this->hasMany(RegistryEntryRelationship::class);
    }

    public function isExportable(): bool
    {
        return $this->status === 'valid' && $this->schema_version === config('sibyl.schema_version');
    }
}
