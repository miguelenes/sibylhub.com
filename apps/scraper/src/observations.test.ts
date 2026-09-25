import { describe, expect, it } from "vitest";
import { normalizeObservations } from "./observations.js";

describe("source observations", () => {
  it("preserves conflicting repository, license, and star observations", () => {
    const result = normalizeObservations([
      {
        kind: "repository",
        value: "https://github.com/registry/project",
        sourceId: "npm",
        evidenceIds: ["npm-repo"],
      },
      {
        kind: "repository",
        value: "https://github.com/curated/project",
        sourceId: "libs-tech",
        evidenceIds: ["libs-repo"],
      },
      {
        kind: "license",
        value: "MIT",
        sourceId: "npm",
        evidenceIds: ["npm-license"],
      },
      {
        kind: "license",
        value: "Apache-2.0",
        sourceId: "libs-tech",
        evidenceIds: ["libs-license"],
      },
      {
        kind: "stars",
        value: "100",
        sourceId: "npm",
        evidenceIds: ["npm-stars"],
      },
      {
        kind: "stars",
        value: "110",
        sourceId: "libs-tech",
        evidenceIds: ["libs-stars"],
      },
    ]);

    expect(result.observations).toHaveLength(6);
    expect(result.conflicts.map((conflict) => conflict.kind)).toEqual([
      "license",
      "repository",
      "stars",
    ]);
    expect(result.conflicts[0]?.values).toEqual(["Apache-2.0", "MIT"]);
  });
});
