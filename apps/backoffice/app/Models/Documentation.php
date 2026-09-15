<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Documentation extends Model
{
    use HasFactory;

    protected $fillable = ['documentable_type', 'documentable_id', 'source_url', 'r2_key', 'content_hash', 'token_count', 'scraped_at'];

    protected function casts(): array
    {
        return ['scraped_at' => 'datetime'];
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(DocumentationChunk::class);
    }
}
