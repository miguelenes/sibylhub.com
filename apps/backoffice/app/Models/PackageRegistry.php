<?php

namespace App\Models;

use App\Enums\RegistryPurlType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PackageRegistry extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'name', 'purl_type', 'purl_namespace', 'homepage_url', 'api_url', 'supports_namespaces'];

    protected function casts(): array
    {
        return ['purl_type' => RegistryPurlType::class, 'supports_namespaces' => 'boolean'];
    }

    public function packageManagers(): HasMany
    {
        return $this->hasMany(PackageManager::class);
    }
}
