<?php

namespace App\Models;

use App\Enums\InvariantSeverity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

class StackInvariant extends Model
{
    use HasFactory;

    protected $fillable = ['package_category_id', 'approved_package_id', 'banned_package_id', 'runtime_id', 'framework_package_id', 'slug', 'name', 'severity', 'reason', 'replacement_example', 'migration_url'];

    protected function casts(): array
    {
        return ['severity' => InvariantSeverity::class];
    }

    protected static function booted(): void
    {
        static::saving(function (self $invariant): void {
            if ($invariant->approved_package_id !== null && $invariant->approved_package_id === $invariant->banned_package_id) {
                throw new InvalidArgumentException('Approved and banned packages must be distinct.');
            }
        });
    }

    public function packageCategory(): BelongsTo
    {
        return $this->belongsTo(PackageCategory::class);
    }

    public function approvedPackage(): BelongsTo
    {
        return $this->belongsTo(Package::class, 'approved_package_id');
    }

    public function bannedPackage(): BelongsTo
    {
        return $this->belongsTo(Package::class, 'banned_package_id');
    }

    public function runtime(): BelongsTo
    {
        return $this->belongsTo(Runtime::class);
    }

    public function frameworkPackage(): BelongsTo
    {
        return $this->belongsTo(Package::class, 'framework_package_id');
    }
}
