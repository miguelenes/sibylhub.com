<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CandidateEvidence extends Model
{
    use HasFactory;

    protected $table = 'candidate_evidence';

    protected $fillable = ['ingestion_batch_id', 'staged_candidate_id', 'evidence_id', 'source_id', 'source_kind', 'source_url', 'retrieved_at', 'content_hash', 'evidence_type', 'locator', 'excerpt', 'raw_response'];

    protected function casts(): array
    {
        return ['retrieved_at' => 'datetime'];
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(StagedCandidate::class, 'staged_candidate_id');
    }
}
