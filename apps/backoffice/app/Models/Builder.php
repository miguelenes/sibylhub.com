<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Builder extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'name', 'configuration_files', 'run_command'];

    protected function casts(): array
    {
        return ['configuration_files' => 'array'];
    }

    public function programmingLanguages(): BelongsToMany
    {
        return $this->belongsToMany(ProgrammingLanguage::class, 'builder_language');
    }
}
