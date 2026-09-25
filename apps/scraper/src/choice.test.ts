import { describe, expect, it } from "vitest";
import { assessOpinionatedChoice } from "./choice.js";

const base = {
  sourceId: "npm",
  ecosystem: "javascript",
  packageName: "react",
  purl: { type: "npm", name: "react", version: "managed" },
  evidenceIds: ["evidence-package"],
  rank: { sourceId: "npm", basis: "source-ranked" as const },
  downloads: [
    {
      sourceId: "npm",
      value: 120,
      priorSample: 100,
      period: "month",
      sampledAt: "2026-09-22T12:00:00.000Z",
      evidenceIds: ["evidence-downloads"],
    },
  ],
  stars: [
    {
      sourceId: "github",
      value: 1000,
      sampledAt: "2026-09-22T12:00:00.000Z",
      evidenceIds: ["evidence-stars"],
    },
  ],
};

describe("advisory choice assessment", () => {
  it("returns bounded factors and a score when comparable signals exist", () => {
    const assessment = assessOpinionatedChoice(base, {
      maintenance: { value: 0.8, evidenceIds: ["evidence-maintenance"] },
      adoption: { value: 0.9, evidenceIds: ["evidence-adoption"] },
      edgeCompatibility: { value: 0.7, evidenceIds: ["evidence-edge"] },
    });

    expect(assessment.status).toBe("advisory");
    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBeLessThanOrEqual(1);
    expect(assessment.factors.map((factor) => factor.name)).toEqual([
      "download-trend",
      "maintenance",
      "adoption",
      "edge-compatibility",
    ]);
    expect(assessment.evidenceIds).toContain("evidence-maintenance");
  });

  it("reports insufficient data instead of treating missing signals as positive", () => {
    const assessment = assessOpinionatedChoice(
      { ...base, stars: undefined },
      {},
    );

    expect(assessment.status).toBe("insufficient-data");
    expect(assessment.score).toBeUndefined();
  });
});
