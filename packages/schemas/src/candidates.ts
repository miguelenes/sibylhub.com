import { z } from "zod";
import type {
  CandidateArtifact,
  CandidateEvidence,
  CandidateSchemaVersion,
  Purl,
  ValidationIssue,
  ValidationResult,
} from "./types.js";
import { candidateSchemaVersion } from "./types.js";

const id = z.string().min(1).max(256);
const timestamp = z.string().datetime({ offset: true });
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const url = z.string().url();
const purlSchema = z
  .object({
    type: z.string().regex(/^[a-z0-9][a-z0-9.+-]*$/),
    namespace: z.string().min(1).regex(/^\S+$/).optional(),
    name: z.string().min(1).regex(/^\S+$/),
    version: z.string().min(1).regex(/^\S+$/),
    qualifiers: z.record(z.string(), z.string()).optional(),
    subpath: z.string().min(1).regex(/^\S+$/).optional(),
  })
  .strict();
const sourceKind = z.enum([
  "registry",
  "curated",
  "repository",
  "documentation",
  "classifier",
  "firecrawl",
]);
const rankBasis = z.enum(["global", "source-ranked", "seed-ranked", "curated"]);
const counts = z.number().int().nonnegative();
const evidenceRef = z.array(id);

const evidenceSchema = z
  .object({
    id,
    sourceId: id,
    sourceKind,
    sourceUrl: url,
    retrievedAt: timestamp,
    contentHash: sha256,
    evidenceType: id,
    locator: z.string().max(256).optional(),
    excerpt: z.string().max(2048).optional(),
    rawResponse: z.string().max(8192).optional(),
  })
  .strict();

const candidateSchema = z
  .object({
    candidateId: id,
    ecosystem: id,
    purl: purlSchema,
    name: id,
    namespace: z.string().min(1).regex(/^\S+$/).optional(),
    releaseVersion: z.string().min(1).optional(),
    homepageUrl: url.optional(),
    repositoryUrl: url.optional(),
    license: id.optional(),
    description: z.string().max(10000).optional(),
    keywords: z.array(id).max(500).optional(),
    downloads: z
      .array(
        z
          .object({
            sourceId: id,
            value: z.number().nonnegative(),
            period: id,
            sampledAt: timestamp,
            priorSample: z.number().nonnegative().optional(),
            evidenceIds: evidenceRef,
          })
          .strict(),
      )
      .optional(),
    stars: z
      .array(
        z
          .object({
            sourceId: id,
            value: z.number().int().nonnegative(),
            sampledAt: timestamp,
            repositoryUrl: url.optional(),
            evidenceIds: evidenceRef,
          })
          .strict(),
      )
      .optional(),
    evidenceIds: evidenceRef.min(1),
    rank: z
      .object({
        sourceId: id,
        basis: rankBasis,
        position: z.number().int().positive().optional(),
        seed: id.optional(),
      })
      .strict(),
    detections: z.array(
      z
        .object({
          kind: z.enum(["framework", "category"]),
          name: id,
          confidence: z.enum(["unknown", "low", "medium", "high"]),
          classifierVersion: id,
          rationale: z.string().max(2000),
          evidenceIds: evidenceRef.min(1),
        })
        .strict(),
    ),
    choiceAssessment: z
      .object({
        score: z.number().min(0).max(1).optional(),
        status: z.enum(["advisory", "insufficient-data", "review-required"]),
        summary: z.string().max(2000),
        factors: z.array(
          z
            .object({
              name: id,
              value: z.number().optional(),
              weight: z.number().min(0).max(1),
              evidenceIds: evidenceRef,
            })
            .strict(),
        ),
        evidenceIds: evidenceRef,
      })
      .strict()
      .optional(),
    observations: z
      .array(
        z
          .object({
            kind: z.enum([
              "category",
              "alternative",
              "comparison",
              "pro",
              "con",
              "opinion",
              "repository",
              "license",
              "stars",
            ]),
            value: z.union([z.string(), z.number()]),
            sourceId: id,
            evidenceIds: evidenceRef,
          })
          .strict(),
      )
      .optional(),
    resolution: z
      .object({
        status: z.enum(["unresolved", "partial", "resolved"]),
        packageManagerId: id.optional(),
        packageCategoryId: id.optional(),
      })
      .strict(),
  })
  .strict();

const candidateArtifactSchema = z
  .object({
    artifactKind: z.literal("candidate-ingestion"),
    schemaVersion: z.literal(candidateSchemaVersion),
    crawl: z
      .object({
        id,
        startedAt: timestamp,
        completedAt: timestamp.optional(),
        configHash: sha256,
        classifierVersions: z.record(id, id),
      })
      .strict(),
    sourceCoverage: z.array(
      z
        .object({
          sourceId: id,
          ecosystem: id,
          status: z.enum([
            "success",
            "partial",
            "failed",
            "skipped",
            "unsupported",
          ]),
          rankBasis,
          seed: id.optional(),
          sourceUrl: url.optional(),
          discovered: counts,
          deduplicated: counts,
          detailed: counts,
          normalized: counts,
          classified: counts,
          conflicted: counts,
          synchronized: counts,
          skipped: counts,
          failed: counts,
        })
        .strict(),
    ),
    candidates: z.array(candidateSchema),
    evidence: z.array(evidenceSchema),
    diagnostics: z.array(
      z
        .object({
          severity: z.enum(["info", "warning", "error"]),
          code: id,
          message: z.string().max(2000),
          candidateId: id.optional(),
          sourceId: id.optional(),
        })
        .strict(),
    ),
    telemetry: z
      .object({
        discovered: counts,
        deduplicated: counts,
        detailed: counts,
        normalized: counts,
        classified: counts,
        conflicted: counts,
        synchronized: counts,
        skipped: counts,
        failed: counts,
        requests: z.array(
          z
            .object({
              sourceId: id,
              requestClass: id,
              attempts: z.number().int().positive(),
              status: z.number().int().min(100).max(599).optional(),
              durationMs: z.number().nonnegative(),
              pageOrSeed: id.optional(),
            })
            .strict(),
        ),
      })
      .strict(),
    contentIdentity: sha256,
  })
  .strict();

function unsafeIssues(input: unknown): ValidationIssue[] {
  const serialized = JSON.stringify(input);
  const patterns = [
    ["bearer_token", /\bbearer\s+[a-z0-9._~+/=-]+/i],
    ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
    [
      "secret_value",
      /["']?(password|token|secret|authorization)["']?\s*[:=]\s*["']?[^,}\\"']+/i,
    ],
    [
      "executable_directive",
      /(^|["'])\s*(command|exec|script|shell)\s*["']\s*:/i,
    ],
  ] as const;
  return patterns
    .filter(([, pattern]) => pattern.test(serialized))
    .map(([code]) => ({
      path: "$",
      code,
      message: "Unsafe content is not accepted in candidate artifacts",
    }));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  return value;
}

export function serializeDeterministic(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function candidateIdentity(purl: Purl): string {
  const namespace = purl.namespace
    ? `${purl.namespace.split("/").map(encodeURIComponent).join("/")}/`
    : "";
  const qualifiers = purl.qualifiers
    ? `?${Object.entries(purl.qualifiers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join("&")}`
    : "";
  const subpath = purl.subpath ? `#${encodeURIComponent(purl.subpath)}` : "";
  return `pkg:${purl.type.toLowerCase()}/${namespace}${encodeURIComponent(purl.name)}@${encodeURIComponent(purl.version)}${qualifiers}${subpath}`;
}

function candidateParse(input: unknown): ValidationResult<CandidateArtifact> {
  const version =
    typeof input === "object" && input !== null && "schemaVersion" in input
      ? String((input as { schemaVersion: unknown }).schemaVersion)
      : undefined;
  if (version !== candidateSchemaVersion)
    return {
      valid: false,
      schemaVersion: version,
      issues: [
        {
          path: "schemaVersion",
          code: "unsupported_schema_version",
          message: `Expected ${candidateSchemaVersion}`,
        },
      ],
    };
  const unsafe = unsafeIssues(input);
  if (unsafe.length)
    return { valid: false, schemaVersion: version, issues: unsafe };
  const parsed = candidateArtifactSchema.safeParse(input);
  if (!parsed.success)
    return {
      valid: false,
      schemaVersion: version,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    };
  const artifact = parsed.data as CandidateArtifact;
  const evidenceIds = new Set(artifact.evidence.map((item) => item.id));
  const issues: ValidationIssue[] = [];
  const checkEvidence = (ids: string[], path: string) => {
    for (const evidenceId of ids)
      if (!evidenceIds.has(evidenceId))
        issues.push({
          path,
          code: "unresolved_evidence",
          message: `Unknown evidence identifier ${evidenceId}`,
        });
  };
  for (const [index, candidate] of artifact.candidates.entries()) {
    if (candidate.candidateId !== candidateIdentity(candidate.purl))
      issues.push({
        path: `candidates.${index}.candidateId`,
        code: "identity_mismatch",
        message: "Candidate identity must be derived from its canonical PURL",
      });
    checkEvidence(candidate.evidenceIds, `candidates.${index}.evidenceIds`);
    for (const [detectionIndex, detection] of candidate.detections.entries())
      checkEvidence(
        detection.evidenceIds,
        `candidates.${index}.detections.${detectionIndex}.evidenceIds`,
      );
    for (const [downloadIndex, download] of (
      candidate.downloads ?? []
    ).entries())
      checkEvidence(
        download.evidenceIds,
        `candidates.${index}.downloads.${downloadIndex}.evidenceIds`,
      );
    for (const [starIndex, star] of (candidate.stars ?? []).entries())
      checkEvidence(
        star.evidenceIds,
        `candidates.${index}.stars.${starIndex}.evidenceIds`,
      );
    if (candidate.choiceAssessment) {
      checkEvidence(
        candidate.choiceAssessment.evidenceIds,
        `candidates.${index}.choiceAssessment.evidenceIds`,
      );
      for (const [
        factorIndex,
        factor,
      ] of candidate.choiceAssessment.factors.entries())
        checkEvidence(
          factor.evidenceIds,
          `candidates.${index}.choiceAssessment.factors.${factorIndex}.evidenceIds`,
        );
    }
  }
  for (const [index, evidence] of artifact.evidence.entries()) {
    if (evidence.rawResponse && evidence.rawResponse.length > 8192)
      issues.push({
        path: `evidence.${index}.rawResponse`,
        code: "bounded_field_exceeded",
        message: "Raw provider responses must remain bounded",
      });
  }
  return issues.length
    ? { valid: false, schemaVersion: version, issues }
    : { valid: true, data: artifact, schemaVersion: version, issues: [] };
}

export function validateCandidateArtifact(
  input: unknown,
): ValidationResult<CandidateArtifact> {
  return candidateParse(input);
}

export function normalizeCandidatePurl(input: Purl): Purl {
  return {
    ...input,
    type: input.type.toLowerCase(),
    namespace: input.namespace?.trim() || undefined,
    name: input.name.trim(),
    version: input.version.trim(),
    qualifiers: input.qualifiers
      ? Object.fromEntries(
          Object.entries(input.qualifiers).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : undefined,
    subpath: input.subpath?.trim() || undefined,
  };
}

export { candidateSchemaVersion };
export type { CandidateArtifact, CandidateEvidence, CandidateSchemaVersion };
