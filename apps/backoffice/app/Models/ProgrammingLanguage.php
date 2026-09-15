<?php

namespace App\Models;

use App\Enums\RegistryPurlType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProgrammingLanguage extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'name', 'extensions', 'purl_type', 'purl_namespace', 'default_package_manager_id'];

    protected function casts(): array
    {
        return ['extensions' => 'array', 'purl_type' => RegistryPurlType::class];
    }

    public function defaultPackageManager(): BelongsTo
    {
        return $this->belongsTo(PackageManager::class, 'default_package_manager_id');
    }

    public function runtimes(): HasMany
    {
        return $this->hasMany(Runtime::class);
    }

    public function packageManagers(): HasMany
    {
        return $this->hasMany(PackageManager::class);
    }

    public function builders(): BelongsToMany
    {
        return $this->belongsToMany(Builder::class, 'builder_language');
    }
}
