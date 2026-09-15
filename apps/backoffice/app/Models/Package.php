<?php

namespace App\Models;

use App\Enums\RegistryPurlType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Package extends Model
{
    use HasFactory;

    protected $fillable = ['package_manager_id', 'package_category_id', 'slug', 'name', 'purl_type', 'purl_namespace', 'homepage_url', 'repository_url', 'license', 'opinionated', 'rationale'];

    protected function casts(): array
    {
        return ['purl_type' => RegistryPurlType::class, 'opinionated' => 'boolean'];
    }

    public function packageManager(): BelongsTo
    {
        return $this->belongsTo(PackageManager::class);
    }

    public function packageCategory(): BelongsTo
    {
        return $this->belongsTo(PackageCategory::class);
    }

    public function runtimes(): BelongsToMany
    {
        return $this->belongsToMany(Runtime::class, 'package_runtime_compatibility')->using(PackageRuntimeCompatibility::class)->withPivot(['compatible', 'notes'])->withTimestamps();
    }

    public function approvedInvariants(): HasMany
    {
        return $this->hasMany(StackInvariant::class, 'approved_package_id');
    }

    public function bannedInvariants(): HasMany
    {
        return $this->hasMany(StackInvariant::class, 'banned_package_id');
    }

    public function frameworkInvariants(): HasMany
    {
        return $this->hasMany(StackInvariant::class, 'framework_package_id');
    }
}
