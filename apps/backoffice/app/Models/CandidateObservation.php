<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CandidateObservation extends Model
{
    use HasFactory;

    protected $fillable = ['ingestion_batch_id', 'staged_candidate_id', 'kind', 'value', 'source_id', 'evidence_ids'];

    protected function casts(): array
    {
        return ['evidence_ids' => 'array'];
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(StagedCandidate::class, 'staged_candidate_id');
    }
}
