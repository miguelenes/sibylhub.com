import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { candidateIdentity } from "@sibylhub/schemas/candidates";
import type { CandidateArtifact } from "@sibylhub/schemas";
import { SynchronizationClient, writeSynchronizationReport } from "./sync.js";

const artifact = {
  artifactKind: "candidate-ingestion",
  schemaVersion: "candidate-ingestion/1.0",
  crawl: {
    id: "crawl-1",
    startedAt: "2026-01-01T00:00:00.000Z",
    configHash: "sha256:" + "a".repeat(64),
    classifierVersions: {},
  },
  sourceCoverage: [],
  candidates: [
    {
      candidateId: candidateIdentity({
        type: "npm",
        name: "one",
        version: "managed",
      }),
      ecosystem: "javascript",
      purl: { type: "npm", name: "one", version: "managed" },
      name: "one",
      evidenceIds: ["e1"],
      rank: { sourceId: "npm", basis: "source-ranked" },
      detections: [],
      resolution: { status: "unresolved" },
    },
  ],
  evidence: [
    {
      id: "e1",
      sourceId: "npm",
      sourceKind: "registry",
      sourceUrl: "https://registry.npmjs.org/one",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      contentHash: "sha256:" + "b".repeat(64),
      evidenceType: "detail",
    },
  ],
  diagnostics: [],
  telemetry: {
    discovered: 1,
    deduplicated: 1,
    detailed: 1,
    normalized: 1,
    classified: 0,
    conflicted: 0,
    synchronized: 0,
    skipped: 0,
    failed: 0,
    requests: [],
  },
  contentIdentity: "sha256:" + "c".repeat(64),
} satisfies CandidateArtifact;

describe("synchronization client", () => {
  it("sends bounded snake_case batches with redacted transport errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          outcomes: [
            {
              candidate_id: artifact.candidates[0].candidateId,
              status: "accepted",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new SynchronizationClient({
      url: "https://backoffice.test/api/v1/ingest/packages",
      token: "secret-token",
      maxBatchSize: 1,
    });
    const report = await client.synchronize(artifact);
    expect(report.accepted).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer secret-token",
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      schema_version: "candidate-ingestion/1.0",
      crawl_id: "crawl-1",
    });
    fetchMock.mockRestore();
  });

  it("records retryable outcomes without losing the local artifact", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("network unavailable"),
    );
    const client = new SynchronizationClient({
      url: "https://backoffice.test/api/v1/ingest/packages",
      token: "secret-token",
      maxBatchSize: 10,
    });
    const report = await client.synchronize(artifact);
    expect(report.retryable).toBe(1);
    expect(report.outcomes[0]?.status).toBe("retryable");
    vi.restoreAllMocks();
  });

  it("persists a deterministic synchronization report next to the artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sibylhub-sync-"));
    const artifactPath = join(directory, "candidate-ingestion-crawl-1.json");
    const report = {
      crawlId: "crawl-1",
      artifactContentIdentity: artifact.contentIdentity,
      batches: 1,
      outcomes: [
        {
          candidateId: artifact.candidates[0].candidateId,
          status: "accepted" as const,
        },
      ],
      accepted: 1,
      duplicate: 0,
      rejected: 0,
      retryable: 0,
      unsupported: 0,
    };
    const path = await writeSynchronizationReport(report, artifactPath);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(report);
  });
});
