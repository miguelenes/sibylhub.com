<?php

namespace App\Enums;

enum LockfileFormat: string
{
    case Json = 'json';
    case Yaml = 'yaml';
    case Toml = 'toml';
    case Text = 'text';
}
