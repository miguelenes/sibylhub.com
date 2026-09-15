<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RegistryEntry extends Model
{
    protected $fillable = ['registry_revision_id', 'stable_id', 'kind', 'name', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function revision(): BelongsTo
    {
        return $this->belongsTo(RegistryRevision::class, 'registry_revision_id');
    }

    public function outgoingRelationships(): HasMany
    {
        return $this->hasMany(RegistryEntryRelationship::class, 'source_entry_id');
    }

    public function incomingRelationships(): HasMany
    {
        return $this->hasMany(RegistryEntryRelationship::class, 'target_entry_id');
    }
}
