<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentationChunk extends Model
{
    use HasFactory;

    protected $fillable = ['documentation_id', 'ordinal', 'start_offset', 'end_offset', 'token_count', 'summary'];

    public function documentation(): BelongsTo
    {
        return $this->belongsTo(Documentation::class);
    }
}
