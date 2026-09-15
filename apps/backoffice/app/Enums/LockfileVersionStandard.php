<?php

namespace App\Enums;

enum LockfileVersionStandard: string
{
    case Major = 'major';
    case Minor = 'minor';
    case Exact = 'exact';
    case Semver = 'semver';
}
