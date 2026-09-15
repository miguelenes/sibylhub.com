<?php

namespace App\Enums;

enum InvariantSeverity: string
{
    case Info = 'info';
    case Warning = 'warning';
    case Error = 'error';
    case Critical = 'critical';
}
