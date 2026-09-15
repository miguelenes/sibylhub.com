<?php

namespace App\Enums;

enum RegistryPurlType: string
{
    case Generic = 'generic';
    case Npm = 'npm';
    case Composer = 'composer';
    case Cargo = 'cargo';
    case Maven = 'maven';
    case Nuget = 'nuget';
    case Pypi = 'pypi';
    case Pub = 'pub';
    case Hex = 'hex';
    case Gem = 'gem';
    case Cpan = 'cpan';
    case Cran = 'cran';
    case Golang = 'golang';
    case Hackage = 'hackage';
}
