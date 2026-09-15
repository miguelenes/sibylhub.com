import { describe, expect, it } from "vitest";
import {
  createSkillsDocument,
  validateMemoryQueryRequest,
  validateSkillCatalog,
} from "./contracts";

describe("versioned cockpit contracts", () => {
  it("normalizes bounded memory queries and rejects unsafe input", () => {
    const valid = validateMemoryQueryRequest({
      query: "  context budget  ",
      limit: 3,
      projectId: "local",
    });
    expect(valid).toMatchObject({
      valid: true,
      data: { query: "context budget", limit: 3, projectId: "local" },
    });

    expect(validateMemoryQueryRequest({ query: "token: do-not-send" })).toEqual(
      expect.objectContaining({
        valid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "secret_value" }),
        ]),
      }),
    );
    expect(validateMemoryQueryRequest({ query: "ok", extra: true })).toEqual(
      expect.objectContaining({ valid: false }),
    );
  });

  it("exports only audited declarative skills in stable order", () => {
    const catalog = validateSkillCatalog({
      schemaVersion: "1.0",
      sourceRevision: "local-fixture",
      entries: [
        { id: "zeta", scope: "repo", declarative: true, audited: true },
        { id: "alpha", scope: "repo", declarative: true, audited: true },
        { id: "blocked", scope: "repo", declarative: false, audited: true },
      ],
    });
    expect(catalog.valid).toBe(true);
    if (!catalog.valid) return;
    expect(createSkillsDocument(catalog.data, ["zeta", "alpha"])).toEqual({
      valid: true,
      data: {
        schemaVersion: "1.0",
        skills: [
          { id: "alpha", scope: "repo", declarative: true },
          { id: "zeta", scope: "repo", declarative: true },
        ],
      },
      issues: [],
    });
    expect(createSkillsDocument(catalog.data, ["blocked"])).toMatchObject({
      valid: false,
    });
  });
});
