<?php

namespace App\Models;

use App\Enums\RuntimeEngineType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Runtime extends Model
{
    use HasFactory;

    protected $fillable = ['programming_language_id', 'slug', 'name', 'engine_type', 'version_manager'];

    protected function casts(): array
    {
        return ['engine_type' => RuntimeEngineType::class];
    }

    public function programmingLanguage(): BelongsTo
    {
        return $this->belongsTo(ProgrammingLanguage::class);
    }

    public function packages(): BelongsToMany
    {
        return $this->belongsToMany(Package::class, 'package_runtime_compatibility')->using(PackageRuntimeCompatibility::class)->withPivot(['compatible', 'notes'])->withTimestamps();
    }

    public function invariants(): HasMany
    {
        return $this->hasMany(StackInvariant::class);
    }
}
