<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StagedCandidate extends Model
{
    use HasFactory;

    protected $fillable = ['ingestion_batch_id', 'candidate_id', 'ecosystem', 'purl_type', 'purl_namespace', 'purl_name', 'purl_version', 'payload', 'status'];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(IngestionBatch::class, 'ingestion_batch_id');
    }

    public function evidence(): HasMany
    {
        return $this->hasMany(CandidateEvidence::class);
    }

    public function observations(): HasMany
    {
        return $this->hasMany(CandidateObservation::class);
    }
}
