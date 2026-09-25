<?php

namespace App\Services;

use App\Models\IngestionToken;
use Illuminate\Support\Str;

class IngestionTokenService
{
    /** @return array{token: string, record: IngestionToken} */
    public function issue(string $name, ?string $scope = null): array
    {
        $token = Str::random(64);
        $record = IngestionToken::create([
            'name' => $name,
            'token_hash' => hash('sha256', $token),
            'scope' => $scope ?? config('sibyl.ingestion.scope'),
        ]);

        return ['token' => $token, 'record' => $record];
    }

    public function revoke(IngestionToken $token): void
    {
        $token->forceFill(['revoked_at' => now()])->save();
    }

    /** @return array{token: string, record: IngestionToken} */
    public function rotate(IngestionToken $token): array
    {
        $this->revoke($token);

        return $this->issue($token->name, $token->scope);
    }
}
