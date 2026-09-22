<?php

namespace App\Http\Middleware;

use App\Models\IngestionToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateIngestionToken
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('sibyl.ingestion.enabled')) {
            return response()->json(['message' => 'Candidate ingestion is disabled'], 404);
        }

        $presented = $request->bearerToken();
        if (! is_string($presented) || $presented === '' || preg_match('/\s/', $presented)) {
            return response()->json(['message' => 'Ingestion authentication required'], 401);
        }

        $token = IngestionToken::query()
            ->where('token_hash', hash('sha256', $presented))
            ->where('scope', config('sibyl.ingestion.scope'))
            ->whereNull('revoked_at')
            ->first();
        if (! $token) {
            return response()->json(['message' => 'Ingestion authentication failed'], 401);
        }

        $token->forceFill(['last_used_at' => now()])->saveQuietly();
        $request->attributes->set('ingestion_token', $token);

        return $next($request);
    }
}
