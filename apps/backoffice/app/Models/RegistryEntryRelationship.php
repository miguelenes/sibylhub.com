<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegistryEntryRelationship extends Model
{
    protected $fillable = [
        'registry_revision_id',
        'source_entry_id',
        'target_entry_id',
        'relationship',
    ];

    public function revision(): BelongsTo
    {
        return $this->belongsTo(RegistryRevision::class, 'registry_revision_id');
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(RegistryEntry::class, 'source_entry_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(RegistryEntry::class, 'target_entry_id');
    }
}
