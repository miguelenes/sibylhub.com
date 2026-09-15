<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Preserve the historical rows under an explicit archive namespace while
        // removing the old generic table names from the live application surface.
        if (Schema::hasTable('registry_entry_relationships')) {
            Schema::rename('registry_entry_relationships', 'legacy_registry_entry_relationships');
        }
        if (Schema::hasTable('registry_entries')) {
            Schema::rename('registry_entries', 'legacy_registry_entries');
        }
        if (Schema::hasTable('registry_revisions')) {
            Schema::rename('registry_revisions', 'legacy_registry_revisions');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('legacy_registry_revisions')) {
            Schema::rename('legacy_registry_revisions', 'registry_revisions');
        }
        if (Schema::hasTable('legacy_registry_entries')) {
            Schema::rename('legacy_registry_entries', 'registry_entries');
        }
        if (Schema::hasTable('legacy_registry_entry_relationships')) {
            Schema::rename('legacy_registry_entry_relationships', 'registry_entry_relationships');
        }
    }
};
