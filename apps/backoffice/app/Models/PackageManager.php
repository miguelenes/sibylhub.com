<?php

namespace App\Models;

use App\Enums\RegistryPurlType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PackageManager extends Model
{
    use HasFactory;

    protected $fillable = ['programming_language_id', 'package_registry_id', 'slug', 'name', 'purl_type', 'purl_namespace', 'binary', 'manifest_file', 'lockfile_file', 'install_command', 'add_command'];

    protected function casts(): array
    {
        return ['purl_type' => RegistryPurlType::class];
    }

    public function programmingLanguage(): BelongsTo
    {
        return $this->belongsTo(ProgrammingLanguage::class);
    }

    public function packageRegistry(): BelongsTo
    {
        return $this->belongsTo(PackageRegistry::class);
    }

    public function lockfileSpecifications(): HasMany
    {
        return $this->hasMany(LockfileSpecification::class);
    }

    public function workspaceConfigurations(): HasMany
    {
        return $this->hasMany(WorkspaceConfiguration::class);
    }

    public function packages(): HasMany
    {
        return $this->hasMany(Package::class);
    }
}
