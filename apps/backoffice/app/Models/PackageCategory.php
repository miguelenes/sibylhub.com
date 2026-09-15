<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PackageCategory extends Model
{
    use HasFactory;

    protected $fillable = ['slug', 'name', 'description'];

    public function packages(): HasMany
    {
        return $this->hasMany(Package::class);
    }

    public function invariants(): HasMany
    {
        return $this->hasMany(StackInvariant::class);
    }
}
