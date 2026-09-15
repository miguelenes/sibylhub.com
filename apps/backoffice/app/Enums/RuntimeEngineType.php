<?php

namespace App\Enums;

enum RuntimeEngineType: string
{
    case Compiler = 'compiler';
    case Interpreter = 'interpreter';
    case VirtualMachine = 'virtual_machine';
    case Transpiler = 'transpiler';
}
