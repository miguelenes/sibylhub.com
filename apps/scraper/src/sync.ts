import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { serializeDeterministic } from "@sibylhub/schemas/candidates";
import type { CandidateArtifact, PackageCandidate } from "@sibylhub/schemas";

export type SyncOutcomeStatus =
  "accepted" | "duplicate" | "rejected" | "retryable" | "unsupported";
export type SyncOutcome = {
  candidateId: string;
  status: SyncOutcomeStatus;
  message?: string;
};
export type SynchronizationReport = {
  crawlId: string;
  artifactContentIdentity: string;
  batches: number;
  outcomes: SyncOutcome[];
  accepted: number;
  duplicate: number;
  rejected: number;
  retryable: number;
  unsupported: number;
};

export type SynchronizationOptions = {
  url: string;
  token: string;
  maxBatchSize: number;
  timeoutMs?: number;
  maxAttempts?: number;
  maxResponseBytes?: number;
};

function idempotencyKey(crawlId: string, candidateIds: string[]): string {
  return createHash("sha256")
    .update(`${crawlId}:${candidateIds.slice().sort().join(",")}`)
    .digest("hex");
}

function transportCandidate(
  candidate: PackageCandidate,
): Record<string, unknown> {
  return {
    candidate_id: candidate.candidateId,
    ecosystem: candidate.ecosystem,
    purl: candidate.purl,
    name: candidate.name,
    namespace: candidate.namespace,
    release_version: candidate.releaseVersion,
    homepage_url: candidate.homepageUrl,
    repository_url: candidate.repositoryUrl,
    license: candidate.license,
    description: candidate.description,
    keywords: candidate.keywords,
    downloads: candidate.downloads?.map((item) => ({
      source_id: item.sourceId,
      value: item.value,
      period: item.period,
      sampled_at: item.sampledAt,
      prior_sample: item.priorSample,
      evidence_ids: item.evidenceIds,
    })),
    stars: candidate.stars?.map((item) => ({
      source_id: item.sourceId,
      value: item.value,
      sampled_at: item.sampledAt,
      repository_url: item.repositoryUrl,
      evidence_ids: item.evidenceIds,
    })),
    evidence_ids: candidate.evidenceIds,
    rank: {
      source_id: candidate.rank.sourceId,
      basis: candidate.rank.basis,
      position: candidate.rank.position,
      seed: candidate.rank.seed,
    },
    detections: candidate.detections.map((item) => ({
      kind: item.kind,
      name: item.name,
      confidence: item.confidence,
      classifier_version: item.classifierVersion,
      rationale: item.rationale,
      evidence_ids: item.evidenceIds,
    })),
    choice_assessment: candidate.choiceAssessment
      ? {
          score: candidate.choiceAssessment.score,
          status: candidate.choiceAssessment.status,
          summary: candidate.choiceAssessment.summary,
          factors: candidate.choiceAssessment.factors.map((item) => ({
            name: item.name,
            value: item.value,
            weight: item.weight,
            evidence_ids: item.evidenceIds,
          })),
          evidence_ids: candidate.choiceAssessment.evidenceIds,
        }
      : undefined,
    observations: candidate.observations?.map((item) => ({
      kind: item.kind,
      value: item.value,
      source_id: item.sourceId,
      evidence_ids: item.evidenceIds,
    })),
    resolution: {
      status: candidate.resolution.status,
      package_manager_id: candidate.resolution.packageManagerId,
      package_category_id: candidate.resolution.packageCategoryId,
    },
  };
}

function transportEnvelope(
  artifact: CandidateArtifact,
  candidates: PackageCandidate[],
): Record<string, unknown> {
  return {
    artifact_kind: artifact.artifactKind,
    schema_version: artifact.schemaVersion,
    crawl_id: artifact.crawl.id,
    artifact_content_identity: artifact.contentIdentity,
    candidates: candidates.map(transportCandidate),
    evidence: artifact.evidence.map((item) => ({
      id: item.id,
      source_id: item.sourceId,
      source_kind: item.sourceKind,
      source_url: item.sourceUrl,
      retrieved_at: item.retrievedAt,
      content_hash: item.contentHash,
      evidence_type: item.evidenceType,
      locator: item.locator,
      excerpt: item.excerpt,
    })),
  };
}

function emptyReport(artifact: CandidateArtifact): SynchronizationReport {
  return {
    crawlId: artifact.crawl.id,
    artifactContentIdentity: artifact.contentIdentity,
    batches: 0,
    outcomes: [],
    accepted: 0,
    duplicate: 0,
    rejected: 0,
    retryable: 0,
    unsupported: 0,
  };
}

export class SynchronizationClient {
  constructor(private readonly options: SynchronizationOptions) {
    if (!Number.isInteger(options.maxBatchSize) || options.maxBatchSize < 1)
      throw new Error("Synchronization batch size must be positive");
    if (!options.token || /\s/.test(options.token))
      throw new Error("Synchronization token is unsafe");
    const parsed = new URL(options.url);
    if (
      !/^https?:$/.test(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error("Synchronization URL is unsafe");
  }

  async synchronize(
    artifact: CandidateArtifact,
  ): Promise<SynchronizationReport> {
    const report = emptyReport(artifact);
    for (
      let offset = 0;
      offset < artifact.candidates.length;
      offset += this.options.maxBatchSize
    ) {
      const candidates = artifact.candidates.slice(
        offset,
        offset + this.options.maxBatchSize,
      );
      report.batches += 1;
      const ids = candidates.map((candidate) => candidate.candidateId);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.options.timeoutMs ?? 15_000,
        );
        let response: Response;
        try {
          response = await fetch(this.options.url, {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              Authorization: `Bearer ${this.options.token}`,
              "Idempotency-Key": idempotencyKey(artifact.crawl.id, ids),
            },
            body: JSON.stringify(transportEnvelope(artifact, candidates)),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        const text = await response.text();
        if (!response.ok) throw new Error(`sync_${response.status}`);
        if (
          Buffer.byteLength(text, "utf8") >
          (this.options.maxResponseBytes ?? 100_000)
        )
          throw new Error("sync_response_too_large");
        const parsed = JSON.parse(text) as {
          outcomes?: Array<{
            candidate_id?: unknown;
            status?: unknown;
            message?: unknown;
          }>;
        };
        const outcomes = candidates.map((candidate) => {
          const remote = parsed.outcomes?.find(
            (item) => item.candidate_id === candidate.candidateId,
          );
          const status = remote?.status;
          return {
            candidateId: candidate.candidateId,
            status:
              status === "accepted" ||
              status === "duplicate" ||
              status === "rejected" ||
              status === "unsupported"
                ? status
                : "retryable",
            message:
              typeof remote?.message === "string"
                ? remote.message.slice(0, 256)
                : undefined,
          } satisfies SyncOutcome;
        });
        report.outcomes.push(...outcomes);
      } catch {
        report.outcomes.push(
          ...candidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            status: "retryable" as const,
          })),
        );
      }
    }
    for (const outcome of report.outcomes) report[outcome.status] += 1;
    return report;
  }
}

export async function writeSynchronizationReport(
  report: SynchronizationReport,
  artifactPath: string,
): Promise<string> {
  const target = resolve(`${artifactPath}.sync.json`);
  const parent = resolve(dirname(artifactPath));
  if (!target.startsWith(`${parent}${sep}`))
    throw new Error("Synchronization report path is unsafe");
  await writeFile(target, `${serializeDeterministic(report)}\n`, "utf8");
  return target;
}
