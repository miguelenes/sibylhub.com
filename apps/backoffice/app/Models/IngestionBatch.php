<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IngestionBatch extends Model
{
    use HasFactory;

    protected $fillable = ['crawl_id', 'schema_version', 'content_identity', 'status', 'source_coverage', 'diagnostics', 'telemetry'];

    protected function casts(): array
    {
        return ['source_coverage' => 'array', 'diagnostics' => 'array', 'telemetry' => 'array'];
    }

    public function candidates(): HasMany
    {
        return $this->hasMany(StagedCandidate::class);
    }

    public function outcomes(): HasMany
    {
        return $this->hasMany(IngestionOutcome::class);
    }
}
