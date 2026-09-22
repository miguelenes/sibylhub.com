import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import {
  serializeDeterministic,
  validateCandidateArtifact,
} from "@sibylhub/schemas/candidates";
import type {
  CandidateArtifact,
  CandidateCrawl,
  CandidateDiagnostic,
  CandidateEvidence,
  CandidateSourceCoverage,
  CandidateTelemetry,
  PackageCandidate,
} from "@sibylhub/schemas";

export type CandidateArtifactInput = {
  crawlId: string;
  startedAt: string;
  completedAt?: string;
  configHash: string;
  classifierVersions: Record<string, string>;
  sourceCoverage: CandidateSourceCoverage[];
  candidates: PackageCandidate[];
  evidence: CandidateEvidence[];
  diagnostics: CandidateDiagnostic[];
  telemetry: CandidateTelemetry;
};

export function hashDeterministic(value: unknown): string {
  return `sha256:${createHash("sha256").update(serializeDeterministic(value)).digest("hex")}`;
}

function assertSafeCrawlId(crawlId: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(crawlId))
    throw new Error("Invalid crawl id for an artifact path");
}

function sortedArtifact(
  input: CandidateArtifactInput,
): Omit<CandidateArtifact, "contentIdentity"> {
  assertSafeCrawlId(input.crawlId);
  const crawl: CandidateCrawl = {
    id: input.crawlId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    configHash: input.configHash,
    classifierVersions: input.classifierVersions,
  };
  return {
    artifactKind: "candidate-ingestion",
    schemaVersion: "candidate-ingestion/1.0",
    crawl,
    sourceCoverage: [...input.sourceCoverage].sort((a, b) =>
      a.sourceId.localeCompare(b.sourceId),
    ),
    candidates: [...input.candidates].sort((a, b) =>
      a.candidateId.localeCompare(b.candidateId),
    ),
    evidence: [...input.evidence].sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics: [...input.diagnostics].sort((a, b) =>
      `${a.severity}:${a.code}:${a.candidateId ?? ""}`.localeCompare(
        `${b.severity}:${b.code}:${b.candidateId ?? ""}`,
      ),
    ),
    telemetry: {
      ...input.telemetry,
      requests: [...input.telemetry.requests].sort((a, b) =>
        `${a.sourceId}:${a.requestClass}:${a.pageOrSeed ?? ""}`.localeCompare(
          `${b.sourceId}:${b.requestClass}:${b.pageOrSeed ?? ""}`,
        ),
      ),
    },
  };
}

export function buildCandidateArtifact(
  input: CandidateArtifactInput,
): CandidateArtifact {
  const withoutIdentity = sortedArtifact(input);
  const artifact = {
    ...withoutIdentity,
    contentIdentity: hashDeterministic(withoutIdentity),
  } satisfies CandidateArtifact;
  const result = validateCandidateArtifact(artifact);
  if (!result.valid)
    throw new Error(
      `Candidate artifact validation failed: ${result.issues[0]?.message}`,
    );
  return result.data;
}

export async function writeCandidateArtifact(
  artifact: CandidateArtifact,
  artifactDir: string,
  maxBytes: number,
): Promise<{ path: string; bytes: number }> {
  const result = validateCandidateArtifact(artifact);
  if (!result.valid)
    throw new Error(
      `Candidate artifact validation failed: ${result.issues[0]?.message}`,
    );
  const base = resolve(artifactDir);
  const path = resolve(base, `candidate-ingestion-${artifact.crawl.id}.json`);
  if (!path.startsWith(`${base}${sep}`))
    throw new Error("Artifact path escapes configured directory");
  const serialized = `${serializeDeterministic(artifact)}\n`;
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > maxBytes)
    throw new Error("Candidate artifact exceeds configured size limit");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serialized, { encoding: "utf8", flag: "w" });
  return { path, bytes };
}

export function artifactFileName(artifact: CandidateArtifact): string {
  assertSafeCrawlId(artifact.crawl.id);
  return basename(`candidate-ingestion-${artifact.crawl.id}.json`);
}
