<?php

namespace App\Services;

use App\Models\CandidateEvidence;
use App\Models\CandidateObservation;
use App\Models\IngestionBatch;
use App\Models\IngestionOutcome;
use App\Models\StagedCandidate;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CandidateIngestionService
{
    /** @return array<string, mixed> */
    public function ingest(array $envelope): array
    {
        $this->validateEnvelope($envelope);
        $crawlId = (string) $envelope['crawl_id'];
        $contentIdentity = (string) $envelope['artifact_content_identity'];
        $existing = IngestionBatch::query()->where('crawl_id', $crawlId)->first();
        if ($existing !== null) {
            if ($existing->content_identity !== $contentIdentity) {
                throw ValidationException::withMessages(['crawl_id' => 'The crawl identity is already bound to another artifact']);
            }

            return $this->responseForBatch($existing, true);
        }

        $batch = DB::transaction(function () use ($envelope, $crawlId, $contentIdentity): IngestionBatch {
            $batch = IngestionBatch::create([
                'crawl_id' => $crawlId,
                'schema_version' => $envelope['schema_version'],
                'content_identity' => $contentIdentity,
                'status' => 'received',
                'source_coverage' => $envelope['source_coverage'] ?? [],
                'diagnostics' => $envelope['diagnostics'] ?? [],
                'telemetry' => $envelope['telemetry'] ?? [],
            ]);
            $evidence = collect($envelope['evidence'] ?? [])->keyBy('id');
            foreach ($envelope['candidates'] as $candidate) {
                $candidateId = is_array($candidate) && isset($candidate['candidate_id']) ? (string) $candidate['candidate_id'] : 'unknown';
                try {
                    $canonical = $this->validateCandidate($candidate, $evidence->keys()->all());
                    $staged = StagedCandidate::create([
                        'ingestion_batch_id' => $batch->id,
                        'candidate_id' => $canonical['candidateId'],
                        'ecosystem' => $canonical['ecosystem'],
                        'purl_type' => $canonical['purl']['type'],
                        'purl_namespace' => $canonical['purl']['namespace'] ?? null,
                        'purl_name' => $canonical['purl']['name'],
                        'purl_version' => $canonical['purl']['version'],
                        'payload' => $canonical,
                        'status' => 'accepted',
                    ]);
                    foreach ($evidence as $item) {
                        if (! in_array($item['id'], $canonical['evidenceIds'], true)) {
                            continue;
                        }
                        CandidateEvidence::create([
                            'ingestion_batch_id' => $batch->id,
                            'staged_candidate_id' => $staged->id,
                            'evidence_id' => $item['id'],
                            'source_id' => $item['source_id'],
                            'source_kind' => $item['source_kind'],
                            'source_url' => $item['source_url'],
                            'retrieved_at' => $item['retrieved_at'],
                            'content_hash' => $item['content_hash'],
                            'evidence_type' => $item['evidence_type'],
                            'locator' => $item['locator'] ?? null,
                            'excerpt' => $item['excerpt'] ?? null,
                            'raw_response' => null,
                        ]);
                    }
                    foreach ($canonical['observations'] ?? [] as $observation) {
                        CandidateObservation::create([
                            'ingestion_batch_id' => $batch->id,
                            'staged_candidate_id' => $staged->id,
                            'kind' => $observation['kind'],
                            'value' => is_scalar($observation['value']) ? (string) $observation['value'] : json_encode($observation['value']),
                            'source_id' => $observation['sourceId'],
                            'evidence_ids' => $observation['evidenceIds'],
                        ]);
                    }
                    IngestionOutcome::create([
                        'ingestion_batch_id' => $batch->id,
                        'staged_candidate_id' => $staged->id,
                        'candidate_id' => $candidateId,
                        'status' => 'accepted',
                        'diagnostics' => [],
                    ]);
                } catch (\Throwable $exception) {
                    IngestionOutcome::create([
                        'ingestion_batch_id' => $batch->id,
                        'candidate_id' => $candidateId,
                        'status' => 'rejected',
                        'diagnostics' => [['code' => 'candidate_invalid', 'message' => substr($exception->getMessage(), 0, 512)]],
                    ]);
                }
            }
            $batch->forceFill(['status' => 'processed'])->save();

            return $batch;
        });

        return $this->responseForBatch($batch, false);
    }

    /** @return array<string, mixed>|null */
    public function read(string $crawlId): ?array
    {
        $batch = IngestionBatch::query()->where('crawl_id', $crawlId)->first();

        return $batch ? $this->responseForBatch($batch, false) : null;
    }

    /** @param array<string, mixed> $envelope */
    private function validateEnvelope(array $envelope): void
    {
        foreach (['artifact_kind', 'schema_version', 'crawl_id', 'artifact_content_identity', 'candidates', 'evidence'] as $field) {
            if (! array_key_exists($field, $envelope)) {
                throw ValidationException::withMessages([$field => 'This field is required']);
            }
        }
        if ($envelope['artifact_kind'] !== 'candidate-ingestion' || $envelope['schema_version'] !== 'candidate-ingestion/1.0') {
            throw ValidationException::withMessages(['schema_version' => 'Unsupported candidate-ingestion schema']);
        }
        if (! is_string($envelope['crawl_id']) || ! preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/', $envelope['crawl_id'])) {
            throw ValidationException::withMessages(['crawl_id' => 'Invalid crawl identity']);
        }
        if (! is_string($envelope['artifact_content_identity']) || ! preg_match('/^sha256:[0-9a-f]{64}$/', $envelope['artifact_content_identity'])) {
            throw ValidationException::withMessages(['artifact_content_identity' => 'Invalid artifact identity']);
        }
        if (! is_array($envelope['candidates']) || count($envelope['candidates']) > (int) config('sibyl.ingestion.max_candidates')) {
            throw ValidationException::withMessages(['candidates' => 'Candidate batch is invalid or exceeds the configured limit']);
        }
        if (! is_array($envelope['evidence'])) {
            throw ValidationException::withMessages(['evidence' => 'Evidence must be an array']);
        }
        $evidenceIds = [];
        foreach ($envelope['evidence'] as $index => $evidence) {
            if (! is_array($evidence)) {
                throw ValidationException::withMessages(["evidence.{$index}" => 'Evidence must be an object']);
            }
            foreach (['id', 'source_id', 'source_kind', 'source_url', 'retrieved_at', 'content_hash', 'evidence_type'] as $field) {
                if (! isset($evidence[$field]) || ! is_string($evidence[$field]) || $evidence[$field] === '') {
                    throw ValidationException::withMessages(["evidence.{$index}.{$field}" => 'Evidence field is required']);
                }
            }
            if (in_array($evidence['id'], $evidenceIds, true) || ! filter_var($evidence['source_url'], FILTER_VALIDATE_URL) || ! preg_match('/^sha256:[0-9a-f]{64}$/', $evidence['content_hash'])) {
                throw ValidationException::withMessages(["evidence.{$index}" => 'Evidence provenance is invalid']);
            }
            $evidenceIds[] = $evidence['id'];
        }
        $schemaPath = config('sibyl.schema_root').'/json-schema/candidate-ingestion-1.0.json';
        if (! is_file($schemaPath) || json_decode((string) file_get_contents($schemaPath), true) === null) {
            throw ValidationException::withMessages(['schema_version' => 'Published candidate schema artifact is unavailable']);
        }
        if (preg_match('/bearer\s+|BEGIN [A-Z ]*PRIVATE KEY|["\']?(password|token|secret|authorization)["\']?\s*[:=]/i', json_encode($envelope))) {
            throw ValidationException::withMessages(['body' => 'Unsafe credential-bearing content is not accepted']);
        }
    }

    /** @param array<string, mixed> $candidate @param array<int, string> $evidenceIds @return array<string, mixed> */
    private function validateCandidate(array $candidate, array $evidenceIds): array
    {
        foreach (['candidate_id', 'ecosystem', 'purl', 'name', 'evidence_ids', 'rank', 'detections', 'resolution'] as $field) {
            if (! array_key_exists($field, $candidate)) {
                throw new \InvalidArgumentException("Missing candidate field {$field}");
            }
        }
        $purl = $candidate['purl'];
        if (! is_array($purl) || ! is_string($purl['type'] ?? null) || ! is_string($purl['name'] ?? null) || ! is_string($purl['version'] ?? null)) {
            throw new \InvalidArgumentException('Invalid candidate PURL');
        }
        $namespace = isset($purl['namespace']) ? (string) $purl['namespace'] : null;
        $identity = 'pkg:'.strtolower($purl['type']).'/'.($namespace ? implode('/', array_map('rawurlencode', explode('/', $namespace))).'/' : '').rawurlencode($purl['name']).'@'.rawurlencode($purl['version']);
        if (($candidate['candidate_id'] ?? null) !== $identity) {
            throw new \InvalidArgumentException('Candidate identity does not match its PURL');
        }
        if (! is_array($candidate['evidence_ids']) || count(array_diff($candidate['evidence_ids'], $evidenceIds)) > 0) {
            throw new \InvalidArgumentException('Candidate evidence is unresolved');
        }
        foreach ($candidate['detections'] as $detection) {
            if (! is_array($detection) || count(array_diff($detection['evidence_ids'] ?? [], $evidenceIds)) > 0) {
                throw new \InvalidArgumentException('Detection evidence is unresolved');
            }
        }

        return [
            'candidateId' => $candidate['candidate_id'],
            'ecosystem' => $candidate['ecosystem'],
            'purl' => $purl,
            'name' => $candidate['name'],
            'namespace' => $candidate['namespace'] ?? $namespace,
            'releaseVersion' => $candidate['release_version'] ?? null,
            'homepageUrl' => $candidate['homepage_url'] ?? null,
            'repositoryUrl' => $candidate['repository_url'] ?? null,
            'license' => $candidate['license'] ?? null,
            'description' => $candidate['description'] ?? null,
            'keywords' => $candidate['keywords'] ?? null,
            'evidenceIds' => $candidate['evidence_ids'],
            'rank' => $candidate['rank'],
            'detections' => $candidate['detections'],
            'choiceAssessment' => $candidate['choice_assessment'] ?? null,
            'observations' => $candidate['observations'] ?? [],
            'resolution' => $candidate['resolution'],
        ];
    }

    /** @return array<string, mixed> */
    private function responseForBatch(IngestionBatch $batch, bool $duplicateReplay): array
    {
        $outcomes = $batch->outcomes()->orderBy('id')->get()->map(function (IngestionOutcome $outcome) use ($duplicateReplay): array {
            $status = $duplicateReplay && $outcome->status === 'accepted' ? 'duplicate' : $outcome->status;

            return ['candidate_id' => $outcome->candidate_id, 'status' => $status, 'diagnostics' => $outcome->diagnostics ?? []];
        })->all();
        $counts = array_fill_keys(['accepted', 'duplicate', 'rejected', 'retryable', 'unsupported'], 0);
        foreach ($outcomes as $outcome) {
            $counts[$outcome['status']]++;
        }

        return ['batch' => ['id' => $batch->id, 'crawl_id' => $batch->crawl_id, 'schema_version' => $batch->schema_version, 'content_identity' => $batch->content_identity, 'status' => $batch->status], 'counts' => $counts, 'outcomes' => $outcomes];
    }
}
