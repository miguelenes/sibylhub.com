<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IngestionToken extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'token_hash', 'scope', 'revoked_at', 'last_used_at'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['revoked_at' => 'datetime', 'last_used_at' => 'datetime'];
    }
}
