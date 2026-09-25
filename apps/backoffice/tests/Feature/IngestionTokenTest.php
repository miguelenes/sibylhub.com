<?php

namespace Tests\Feature;

use App\Models\IngestionToken;
use App\Services\IngestionTokenService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IngestionTokenTest extends TestCase
{
    use RefreshDatabase;

    public function test_tokens_are_issued_hashed_and_rotation_revokes_the_old_value(): void
    {
        $service = app(IngestionTokenService::class);
        $issued = $service->issue('crawler');

        $this->assertNotSame($issued['token'], $issued['record']->token_hash);
        $this->assertSame(hash('sha256', $issued['token']), $issued['record']->token_hash);

        $rotated = $service->rotate($issued['record']);
        $this->assertNotNull($issued['record']->fresh()->revoked_at);
        $this->assertNotSame($issued['token'], $rotated['token']);
        $this->assertSame(2, IngestionToken::count());
    }
}
