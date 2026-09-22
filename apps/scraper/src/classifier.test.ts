import { describe, expect, it } from "vitest";
import { classifyPackageDetails } from "./classifier.js";

const base = {
  sourceId: "npm",
  ecosystem: "javascript",
  packageName: "",
  purl: { type: "npm", name: "example", version: "managed" },
  evidenceIds: ["evidence-package"],
  rank: { sourceId: "npm", basis: "source-ranked" as const },
};

describe("explainable classifier", () => {
  it("detects a requested framework with evidence and versioned rationale", () => {
    const detections = classifyPackageDetails({
      ...base,
      packageName: "fastapi",
    });
    const framework = detections.find(
      (detection) => detection.name === "FastAPI",
    );

    expect(framework).toMatchObject({
      kind: "framework",
      confidence: "high",
      classifierVersion: "catalog-1",
      evidenceIds: ["evidence-package"],
    });
    expect(framework?.rationale).toMatch(/package name/i);
  });

  it("returns independent detections for multiple categories", () => {
    const detections = classifyPackageDetails({
      ...base,
      packageName: "metadata-tool",
      keywords: ["orm", "migration", "validation"],
    });

    expect(
      detections
        .filter((detection) => detection.kind === "category")
        .map((detection) => detection.name),
    ).toEqual(["ORM", "Migration runner", "Validation"]);
  });

  it("does not infer a classification without evidence", () => {
    expect(
      classifyPackageDetails({
        ...base,
        packageName: "unrelated",
        evidenceIds: [],
      }),
    ).toEqual([]);
  });
});
