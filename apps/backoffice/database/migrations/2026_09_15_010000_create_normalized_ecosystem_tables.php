<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('programming_languages', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->json('extensions');
            $table->string('purl_type', 32);
            $table->string('purl_namespace')->nullable();
            $table->unsignedBigInteger('default_package_manager_id')->nullable();
            $table->timestamps();
        });
        Schema::create('package_registries', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('purl_type', 32);
            $table->string('purl_namespace')->nullable();
            $table->string('homepage_url')->nullable();
            $table->string('api_url')->nullable();
            $table->boolean('supports_namespaces')->default(false);
            $table->timestamps();
        });
        Schema::create('package_categories', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->timestamps();
        });
        Schema::create('runtimes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('programming_language_id')->constrained()->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('engine_type', 32);
            $table->string('version_manager')->nullable();
            $table->timestamps();
        });
        Schema::create('package_managers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('programming_language_id')->constrained()->cascadeOnDelete();
            $table->foreignId('package_registry_id')->nullable()->constrained()->nullOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('purl_type', 32);
            $table->string('purl_namespace')->nullable();
            $table->string('binary');
            $table->string('manifest_file');
            $table->string('lockfile_file')->nullable();
            $table->text('install_command');
            $table->text('add_command');
            $table->timestamps();
        });
        Schema::create('lockfile_specifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('package_manager_id')->constrained()->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('filename');
            $table->string('format', 32);
            $table->string('version_standard', 32);
            $table->boolean('frozen_install')->default(false);
            $table->timestamps();
        });
        Schema::create('workspace_configurations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('package_manager_id')->constrained()->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('manifest');
            $table->string('format', 32);
            $table->string('package_glob');
            $table->boolean('isolated_install')->default(false);
            $table->timestamps();
        });
        Schema::create('packages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('package_manager_id')->constrained()->cascadeOnDelete();
            $table->foreignId('package_category_id')->constrained()->restrictOnDelete();
            $table->string('slug');
            $table->string('name');
            $table->string('purl_type', 32);
            $table->string('purl_namespace')->nullable();
            $table->string('homepage_url')->nullable();
            $table->string('repository_url')->nullable();
            $table->string('license')->nullable();
            $table->boolean('opinionated')->default(false);
            $table->text('rationale')->nullable();
            $table->timestamps();
            $table->unique(['package_manager_id', 'slug']);
        });
        Schema::create('package_runtime_compatibility', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('package_id')->constrained()->cascadeOnDelete();
            $table->foreignId('runtime_id')->constrained()->cascadeOnDelete();
            $table->boolean('compatible');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['package_id', 'runtime_id']);
        });
        Schema::create('builders', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->json('configuration_files');
            $table->text('run_command');
            $table->timestamps();
        });
        Schema::create('builder_language', function (Blueprint $table): void {
            $table->foreignId('builder_id')->constrained()->cascadeOnDelete();
            $table->foreignId('programming_language_id')->constrained()->cascadeOnDelete();
            $table->primary(['builder_id', 'programming_language_id']);
        });
        Schema::create('stack_invariants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('package_category_id')->constrained()->restrictOnDelete();
            $table->foreignId('approved_package_id')->constrained('packages')->restrictOnDelete();
            $table->foreignId('banned_package_id')->constrained('packages')->restrictOnDelete();
            $table->foreignId('runtime_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('framework_package_id')->nullable()->constrained('packages')->nullOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('severity', 32);
            $table->text('reason');
            $table->text('replacement_example')->nullable();
            $table->string('migration_url')->nullable();
            $table->timestamps();
        });
        Schema::create('documentations', function (Blueprint $table): void {
            $table->id();
            $table->string('documentable_type');
            $table->unsignedBigInteger('documentable_id');
            $table->string('source_url')->nullable();
            $table->string('r2_key')->nullable();
            $table->string('content_hash', 128);
            $table->unsignedInteger('token_count')->default(0);
            $table->timestamp('scraped_at')->nullable();
            $table->timestamps();
            $table->index(['documentable_type', 'documentable_id']);
        });
        Schema::create('documentation_chunks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('documentation_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('ordinal');
            $table->unsignedInteger('start_offset');
            $table->unsignedInteger('end_offset');
            $table->unsignedInteger('token_count')->default(0);
            $table->text('summary');
            $table->timestamps();
            $table->unique(['documentation_id', 'ordinal']);
        });
        Schema::table('programming_languages', function (Blueprint $table): void {
            $table->foreign('default_package_manager_id')->references('id')->on('package_managers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documentation_chunks');
        Schema::dropIfExists('documentations');
        Schema::dropIfExists('stack_invariants');
        Schema::dropIfExists('builder_language');
        Schema::dropIfExists('builders');
        Schema::dropIfExists('package_runtime_compatibility');
        Schema::dropIfExists('packages');
        Schema::dropIfExists('workspace_configurations');
        Schema::dropIfExists('lockfile_specifications');
        Schema::dropIfExists('package_managers');
        Schema::dropIfExists('runtimes');
        Schema::dropIfExists('package_categories');
        Schema::dropIfExists('package_registries');
        Schema::dropIfExists('programming_languages');
    }
};
