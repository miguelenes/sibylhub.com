<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class PackageRuntimeCompatibility extends Pivot
{
    protected $table = 'package_runtime_compatibility';

    public $incrementing = true;

    protected $fillable = ['package_id', 'runtime_id', 'compatible', 'notes'];

    protected function casts(): array
    {
        return ['compatible' => 'boolean'];
    }
}
