<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingestion_batches', function (Blueprint $table): void {
            $table->id();
            $table->string('crawl_id', 160);
            $table->string('schema_version', 64);
            $table->string('content_identity', 128);
            $table->string('status', 32);
            $table->json('source_coverage');
            $table->json('diagnostics');
            $table->json('telemetry');
            $table->timestamps();
            $table->unique(['crawl_id', 'content_identity']);
            $table->index('crawl_id');
        });

        Schema::create('staged_candidates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ingestion_batch_id')->constrained()->cascadeOnDelete();
            $table->string('candidate_id', 512);
            $table->string('ecosystem', 64);
            $table->string('purl_type', 64);
            $table->string('purl_namespace')->nullable();
            $table->string('purl_name', 255);
            $table->string('purl_version', 255);
            $table->json('payload');
            $table->string('status', 32);
            $table->timestamps();
            $table->unique(['ingestion_batch_id', 'candidate_id']);
            $table->index(['purl_type', 'purl_namespace', 'purl_name', 'purl_version']);
        });

        Schema::create('candidate_evidence', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ingestion_batch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staged_candidate_id')->nullable()->constrained()->nullOnDelete();
            $table->string('evidence_id', 256);
            $table->string('source_id', 128);
            $table->string('source_kind', 32);
            $table->string('source_url', 2048);
            $table->timestamp('retrieved_at');
            $table->string('content_hash', 128);
            $table->string('evidence_type', 256);
            $table->string('locator', 256)->nullable();
            $table->text('excerpt')->nullable();
            $table->text('raw_response')->nullable();
            $table->timestamps();
            $table->unique(['ingestion_batch_id', 'evidence_id']);
        });

        Schema::create('candidate_observations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ingestion_batch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staged_candidate_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 32);
            $table->text('value');
            $table->string('source_id', 128);
            $table->json('evidence_ids');
            $table->timestamps();
        });

        Schema::create('ingestion_outcomes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ingestion_batch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staged_candidate_id')->nullable()->constrained()->nullOnDelete();
            $table->string('candidate_id', 512);
            $table->string('status', 32);
            $table->json('diagnostics')->nullable();
            $table->timestamps();
            $table->unique(['ingestion_batch_id', 'candidate_id']);
        });

        Schema::create('ingestion_tokens', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 128);
            $table->string('token_hash', 128)->unique();
            $table->string('scope', 128);
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->index(['scope', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ingestion_tokens');
        Schema::dropIfExists('ingestion_outcomes');
        Schema::dropIfExists('candidate_observations');
        Schema::dropIfExists('candidate_evidence');
        Schema::dropIfExists('staged_candidates');
        Schema::dropIfExists('ingestion_batches');
    }
};
