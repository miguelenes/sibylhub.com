<?php

namespace App\Models;

use App\Enums\LockfileFormat;
use App\Enums\LockfileVersionStandard;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LockfileSpecification extends Model
{
    use HasFactory;

    protected $fillable = ['package_manager_id', 'slug', 'name', 'filename', 'format', 'version_standard', 'frozen_install'];

    protected function casts(): array
    {
        return ['format' => LockfileFormat::class, 'version_standard' => LockfileVersionStandard::class, 'frozen_install' => 'boolean'];
    }

    public function packageManager(): BelongsTo
    {
        return $this->belongsTo(PackageManager::class);
    }
}
