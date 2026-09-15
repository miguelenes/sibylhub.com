<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registry_revisions', function (Blueprint $table): void {
            $table->id();
            $table->string('stable_id')->unique();
            $table->string('schema_version', 32);
            $table->string('status', 32);
            $table->json('payload');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'schema_version']);
        });

        Schema::create('registry_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('registry_revision_id')->constrained()->cascadeOnDelete();
            $table->string('stable_id');
            $table->string('kind', 64);
            $table->string('name');
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->unique(['registry_revision_id', 'stable_id']);
            $table->index(['kind', 'stable_id']);
        });

        Schema::create('registry_entry_relationships', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('registry_revision_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_entry_id')->constrained('registry_entries')->cascadeOnDelete();
            $table->foreignId('target_entry_id')->constrained('registry_entries')->cascadeOnDelete();
            $table->string('relationship', 64);
            $table->timestamps();
            $table->unique(['registry_revision_id', 'source_entry_id', 'target_entry_id', 'relationship']);
            $table->index(['registry_revision_id', 'relationship']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registry_entry_relationships');
        Schema::dropIfExists('registry_entries');
        Schema::dropIfExists('registry_revisions');
    }
};
