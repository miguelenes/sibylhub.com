import { describe, expect, it } from "vitest";
import { loadSkillCatalog } from "./catalog-service";

describe("skill catalog boundary", () => {
  it("fails closed when no audited Rosie or FastMCP source is configured", () => {
    expect(loadSkillCatalog()).toMatchObject({
      status: "unavailable",
      catalog: { schemaVersion: "1.0", entries: [] },
    });
  });

  it("accepts validated catalog metadata but does not make blocked entries eligible", () => {
    const result = loadSkillCatalog({
      schemaVersion: "1.0",
      sourceRevision: "fixture-catalog",
      entries: [
        {
          id: "audited-skill",
          scope: "workspace",
          declarative: true,
          audited: true,
        },
        {
          id: "unreviewed-skill",
          scope: "workspace",
          declarative: true,
          audited: false,
        },
      ],
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.catalog.entries[0]?.audited).toBe(true);
      expect(result.catalog.entries[1]?.audited).toBe(false);
    }
  });

  it("rejects unsupported catalog versions", () => {
    expect(
      loadSkillCatalog({
        schemaVersion: "2.0",
        sourceRevision: "x",
        entries: [],
      }),
    ).toMatchObject({ status: "unavailable" });
  });
});
