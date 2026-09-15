import { describe, expect, it } from "vitest";
import { validEcosystem } from "./catalog.js";
import {
  validateAgentConfig,
  validateEcosystem,
  validatePurl,
} from "./validators.js";

describe("shared schema contracts", () => {
  it("accepts the complete 25-language catalog", () => {
    const result = validateEcosystem(validEcosystem);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.languages).toHaveLength(25);
  });

  it("rejects an unresolved relationship", () => {
    const invalid = structuredClone(validEcosystem);
    invalid.languages[0].runtimeId = "runtime-missing";
    const result = validateEcosystem(invalid);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(
        result.issues.some((issue) => issue.code === "unresolved_reference"),
      ).toBe(true);
  });

  it("preserves purl components", () => {
    const result = validatePurl({
      type: "npm",
      namespace: "@sibylhub",
      name: "schemas",
      version: "1.0.0",
      qualifiers: { registry: "public" },
      subpath: "dist",
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.subpath).toBe("dist");
  });

  it("rejects unsafe declarative content", () => {
    const result = validateAgentConfig({
      schemaVersion: "1.0",
      project: "x",
      mode: "declarative",
      runtimeOwners: {},
      safeCommands: [],
      remoteMutationRequiresExplicitCommand: true,
      remoteEvidenceIsSeparate: true,
      token: "secret",
    });
    expect(result.valid).toBe(false);
    if (result.valid === false)
      expect(result.issues[0]?.code).toBe("secret_value");
  });

  it("rejects unsupported schema versions", () => {
    const result = validateEcosystem({
      ...validEcosystem,
      schemaVersion: "2.0",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.schemaVersion).toBe("2.0");
  });
});
