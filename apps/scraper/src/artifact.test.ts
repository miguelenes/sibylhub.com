import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { candidateIdentity } from "@sibylhub/schemas/candidates";
import type { CandidateArtifact, PackageCandidate } from "@sibylhub/schemas";
import { buildCandidateArtifact, writeCandidateArtifact } from "./artifact.js";

const purl = { type: "npm", name: "example", version: "managed" } as const;
const candidate: PackageCandidate = {
  candidateId: candidateIdentity(purl),
  ecosystem: "javascript",
  purl,
  name: "example",
  evidenceIds: ["evidence-npm-example"],
  rank: { sourceId: "npm", basis: "source-ranked", position: 1 },
  detections: [],
  resolution: { status: "unresolved" },
};

function input(candidateList: PackageCandidate[] = [candidate]) {
  return {
    crawlId: "crawl-2026-01-01",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:01:00.000Z",
    configHash: "sha256:" + "a".repeat(64),
    classifierVersions: { "catalog-1": "1" },
    sourceCoverage: [
      {
        sourceId: "npm",
        ecosystem: "javascript",
        status: "success" as const,
        rankBasis: "source-ranked" as const,
        sourceUrl: "https://registry.npmjs.org",
        discovered: candidateList.length,
        deduplicated: candidateList.length,
        detailed: candidateList.length,
        normalized: candidateList.length,
        classified: 0,
        conflicted: 0,
        synchronized: 0,
        skipped: 0,
        failed: 0,
      },
    ],
    candidates: candidateList,
    evidence: [
      {
        id: "evidence-npm-example",
        sourceId: "npm",
        sourceKind: "registry" as const,
        sourceUrl: "https://registry.npmjs.org/example",
        retrievedAt: "2026-01-01T00:00:00.000Z",
        contentHash: "sha256:" + "b".repeat(64),
        evidenceType: "package-detail",
      },
    ],
    diagnostics: [],
    telemetry: {
      discovered: candidateList.length,
      deduplicated: candidateList.length,
      detailed: candidateList.length,
      normalized: candidateList.length,
      classified: 0,
      conflicted: 0,
      synchronized: 0,
      skipped: 0,
      failed: 0,
      requests: [],
    },
  };
}

describe("candidate artifacts", () => {
  it("sorts content and derives a stable content identity", () => {
    const first = buildCandidateArtifact(input([candidate]));
    const second = buildCandidateArtifact(input([candidate]));
    expect(first).toEqual(second);
    expect(first.contentIdentity).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("writes a validated, bounded artifact below the configured directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sibylhub-scraper-"));
    const artifact = buildCandidateArtifact(input());
    const result = await writeCandidateArtifact(artifact, directory, 100_000);
    expect(result.path.startsWith(directory)).toBe(true);
    expect(JSON.parse(await readFile(result.path, "utf8"))).toEqual(artifact);
  });

  it("rejects path traversal and unsafe artifacts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sibylhub-scraper-"));
    expect(() =>
      buildCandidateArtifact({ ...input(), crawlId: "../escape" }),
    ).toThrow(/crawl id/i);
    const unsafe = buildCandidateArtifact(input());
    const withUnsafe = {
      ...unsafe,
      diagnostics: [
        { severity: "error" as const, code: "unsafe", message: "Bearer abc" },
      ],
    };
    await expect(
      writeCandidateArtifact(withUnsafe, directory, 100_000),
    ).rejects.toThrow(/unsafe|validation/i);
  });
});

export type ArtifactTestFixture = CandidateArtifact;
