<?php

namespace App\Enums;

enum WorkspaceFormat: string
{
    case Json = 'json';
    case Yaml = 'yaml';
    case Toml = 'toml';
    case Ini = 'ini';
}
