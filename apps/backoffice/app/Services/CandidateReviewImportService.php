<?php

namespace App\Services;

use App\Models\Package;
use App\Models\PackageCategory;
use App\Models\PackageManager;
use App\Models\StagedCandidate;
use Illuminate\Support\Facades\DB;

class CandidateReviewImportService
{
    /** @param array<string, mixed> $decision */
    public function approve(StagedCandidate $candidate, array $decision): Package
    {
        if ($candidate->status !== 'accepted') {
            throw new \InvalidArgumentException('Only accepted staged candidates can be reviewed');
        }
        foreach (['package_manager_id', 'package_category_id', 'slug', 'opinionated', 'rationale'] as $field) {
            if (! array_key_exists($field, $decision)) {
                throw new \InvalidArgumentException("Review decision requires {$field}");
            }
        }
        $manager = PackageManager::query()->find($decision['package_manager_id']);
        $category = PackageCategory::query()->find($decision['package_category_id']);
        if (! $manager || ! $category) {
            throw new \InvalidArgumentException('Review decision references an unknown catalog relationship');
        }
        if (! is_string($decision['slug']) || ! preg_match('/^[a-z0-9][a-z0-9-]{1,127}$/', $decision['slug'])) {
            throw new \InvalidArgumentException('Review slug is invalid');
        }
        if (! is_bool($decision['opinionated']) || ! is_string($decision['rationale']) || trim($decision['rationale']) === '') {
            throw new \InvalidArgumentException('Administrator opinion fields are invalid');
        }

        $payload = is_array($candidate->payload) ? $candidate->payload : [];
        $observations = is_array($payload['observations'] ?? null) ? $payload['observations'] : [];
        $valuesByKind = [];
        foreach ($observations as $observation) {
            if (! is_array($observation)) {
                continue;
            }
            $kind = (string) ($observation['kind'] ?? '');
            $valuesByKind[$kind][] = (string) ($observation['value'] ?? '');
        }
        foreach ($valuesByKind as $kind => $values) {
            if (count(array_unique($values)) > 1) {
                throw new \InvalidArgumentException("Conflicting {$kind} observations require review resolution");
            }
        }

        return DB::transaction(function () use ($candidate, $decision, $payload, $manager, $category): Package {
            $package = Package::create([
                'package_manager_id' => $manager->id,
                'package_category_id' => $category->id,
                'slug' => $decision['slug'],
                'name' => $payload['name'] ?? $candidate->purl_name,
                'purl_type' => $candidate->purl_type,
                'purl_namespace' => $candidate->purl_namespace,
                'homepage_url' => $payload['homepageUrl'] ?? null,
                'repository_url' => $payload['repositoryUrl'] ?? null,
                'license' => $payload['license'] ?? null,
                'opinionated' => $decision['opinionated'],
                'rationale' => $decision['rationale'],
            ]);
            $candidate->forceFill(['status' => 'imported'])->save();

            return $package;
        });
    }
}
