import { describe, expect, it } from "vitest";
import {
  candidateIdentity,
  serializeDeterministic,
  validateCandidateArtifact,
} from "./candidates.js";

const evidence = {
  id: "evidence-npm-react",
  sourceId: "npm",
  sourceKind: "registry",
  sourceUrl: "https://registry.npmjs.org/react",
  retrievedAt: "2026-09-22T12:00:00.000Z",
  contentHash: `sha256:${"1".repeat(64)}`,
  evidenceType: "package-metadata",
  excerpt: "React is a library for building user interfaces.",
};

const artifact = {
  artifactKind: "candidate-ingestion",
  schemaVersion: "candidate-ingestion/1.0",
  crawl: {
    id: "crawl-2026-09-22",
    startedAt: "2026-09-22T12:00:00.000Z",
    completedAt: "2026-09-22T12:01:00.000Z",
    configHash: `sha256:${"2".repeat(64)}`,
    classifierVersions: { framework: "frameworks-1" },
  },
  sourceCoverage: [
    {
      sourceId: "npm",
      ecosystem: "typescript",
      status: "success",
      rankBasis: "source-ranked",
      discovered: 1,
      deduplicated: 1,
      detailed: 1,
      normalized: 1,
      classified: 1,
      conflicted: 0,
      synchronized: 0,
      skipped: 0,
      failed: 0,
    },
  ],
  candidates: [
    {
      candidateId: "pkg:npm/%40types/react@managed",
      ecosystem: "typescript",
      purl: {
        type: "npm",
        namespace: "@types",
        name: "react",
        version: "managed",
      },
      name: "react",
      namespace: "@types",
      evidenceIds: [evidence.id],
      rank: { sourceId: "npm", basis: "source-ranked", position: 1 },
      detections: [],
      resolution: { status: "unresolved" },
    },
  ],
  evidence: [evidence],
  diagnostics: [],
  telemetry: {
    discovered: 1,
    deduplicated: 1,
    detailed: 1,
    normalized: 1,
    classified: 1,
    conflicted: 0,
    synchronized: 0,
    skipped: 0,
    failed: 0,
    requests: [],
  },
  contentIdentity: `sha256:${"3".repeat(64)}`,
};

describe("candidate-ingestion contract", () => {
  it("accepts a valid unresolved candidate batch", () => {
    const result = validateCandidateArtifact(artifact);

    expect(result.valid).toBe(true);
    if (result.valid)
      expect(result.data.candidates[0]?.resolution.status).toBe("unresolved");
  });

  it("rejects unsupported candidate schema versions", () => {
    const result = validateCandidateArtifact({
      ...artifact,
      schemaVersion: "candidate-ingestion/9.9",
    });

    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(
        result.issues.some(
          (issue) => issue.code === "unsupported_schema_version",
        ),
      ).toBe(true);
  });

  it("rejects bearer tokens in candidate evidence", () => {
    const result = validateCandidateArtifact({
      ...artifact,
      evidence: [
        { ...evidence, excerpt: "Authorization: Bearer do-not-store" },
      ],
    });

    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.issues.some((issue) => issue.code === "bearer_token")).toBe(
        true,
      );
  });

  it("preserves scoped PURL identity and canonical serialization", () => {
    expect(
      candidateIdentity({
        type: "npm",
        namespace: "@types",
        name: "react",
        version: "managed",
      }),
    ).toBe("pkg:npm/%40types/react@managed");
    expect(serializeDeterministic({ z: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"z":1}',
    );
  });

  it("preserves Composer and Go namespace components", () => {
    expect(
      candidateIdentity({
        type: "composer",
        namespace: "acme",
        name: "library",
        version: "managed",
      }),
    ).toBe("pkg:composer/acme/library@managed");
    expect(
      candidateIdentity({
        type: "golang",
        namespace: "github.com/acme",
        name: "library",
        version: "managed",
      }),
    ).toBe("pkg:golang/github.com/acme/library@managed");
  });
});
