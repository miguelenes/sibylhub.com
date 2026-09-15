<?php

namespace App\Models;

use App\Enums\WorkspaceFormat;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceConfiguration extends Model
{
    use HasFactory;

    protected $fillable = ['package_manager_id', 'slug', 'name', 'manifest', 'format', 'package_glob', 'isolated_install'];

    protected function casts(): array
    {
        return ['format' => WorkspaceFormat::class, 'isolated_install' => 'boolean'];
    }

    public function packageManager(): BelongsTo
    {
        return $this->belongsTo(PackageManager::class);
    }
}
