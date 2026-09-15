import { describe, expect, it } from "vitest";
import { validEcosystem } from "./catalog.js";
import {
  validateAgentConfig,
  validateEcosystem,
  validateInvariants,
  validatePurl,
  validateSkills,
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

  it("requires every language relationship and the complete vocabulary", () => {
    const result = validateEcosystem(validEcosystem);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.languages).toHaveLength(25);
      expect(
        result.data.languages.every(
          (language) => language.invariantIds.length > 0,
        ),
      ).toBe(true);
    }
  });

  it("rejects malformed PURLs", () => {
    expect(
      validatePurl({ type: "npm", name: "@scope/pkg", version: "1.0.0" }).valid,
    ).toBe(true);
    expect(
      validatePurl({ type: "npm", name: "bad value", version: "1.0.0" }).valid,
    ).toBe(false);
  });

  it("validates agent, skills, and invariant documents", () => {
    expect(
      validateAgentConfig({
        schemaVersion: "1.0",
        project: "fixture",
        mode: "declarative",
        runtimeOwners: { typescript: "local" },
        safeCommands: ["sibyl check --json"],
        manifestEvidence: [
          {
            path: "package.json",
            kind: "package",
            languageId: "typescript",
            runtimeId: "runtime-typescript",
          },
        ],
        invariantIds: ["invariant-typescript"],
        remoteMutationRequiresExplicitCommand: true,
        remoteEvidenceIsSeparate: true,
      }).valid,
    ).toBe(true);
    expect(
      validateSkills({
        schemaVersion: "1.0",
        skills: [{ id: "schemas", scope: "workspace", declarative: true }],
      }).valid,
    ).toBe(true);
    expect(
      validateInvariants({
        schemaVersion: "1.0",
        rules: [
          {
            id: "invariant-typescript",
            kind: "declared-runtime-and-lockfile",
            languageId: "typescript",
            evidenceFields: ["runtimeId"],
          },
        ],
      }).valid,
    ).toBe(true);
  });
});
