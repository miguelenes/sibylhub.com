<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IngestionOutcome extends Model
{
    use HasFactory;

    protected $fillable = ['ingestion_batch_id', 'staged_candidate_id', 'candidate_id', 'status', 'diagnostics'];

    protected function casts(): array
    {
        return ['diagnostics' => 'array'];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(IngestionBatch::class, 'ingestion_batch_id');
    }
}
