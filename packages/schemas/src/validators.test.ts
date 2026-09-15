import { describe, expect, it } from "vitest";
import { validEcosystem, validRegistry } from "./catalog.js";
import {
  validateAgentConfig,
  validateEcosystem,
  validateLegacyEcosystem,
  validateInvariants,
  validateLanguageArtifact,
  validatePurl,
  validateRegistryArtifactSet,
  validateRegistryIndex,
  validateSkills,
} from "./validators.js";

describe("shared schema contracts", () => {
  it("accepts the complete 25-language split catalog", () => {
    const result = validateRegistryArtifactSet(validRegistry);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.index.languages).toHaveLength(25);
  });

  it("accepts legacy data only through the explicit legacy validator", () => {
    expect(validateLegacyEcosystem(validEcosystem).valid).toBe(true);
    expect(validateEcosystem(validEcosystem).valid).toBe(false);
  });

  it("rejects an unresolved relationship in the split tree", () => {
    const invalid = structuredClone(validRegistry);
    invalid.languages.javascript.invariants[0].bannedPackageId =
      "package-missing";
    const result = validateRegistryArtifactSet(invalid);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(
        result.issues.some((issue) => issue.code === "unresolved_reference"),
      ).toBe(true);
  });

  it("rejects mismatched revision identity", () => {
    const invalid = structuredClone(validRegistry);
    invalid.languages.javascript.revisionId = `sha256:${"1".repeat(64)}`;
    const result = validateRegistryArtifactSet(invalid);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(
        result.issues.some((issue) => issue.code === "identity_mismatch"),
      ).toBe(true);
  });

  it("requires canonical paths and the complete vocabulary", () => {
    const invalid = structuredClone(validRegistry.index);
    invalid.languages[0].path = "languages/not-canonical.json";
    expect(validateRegistryIndex(invalid).valid).toBe(true);
    const result = validateRegistryArtifactSet({
      index: invalid,
      languages: validRegistry.languages,
    });
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.issues.some((issue) => issue.code === "invalid_path")).toBe(
        true,
      );
  });

  it("rejects equal approved and banned packages", () => {
    const invalid = structuredClone(validRegistry);
    invalid.languages.javascript.invariants[0].bannedPackageId =
      invalid.languages.javascript.invariants[0].approvedPackageId;
    const result = validateRegistryArtifactSet(invalid);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(
        result.issues.some(
          (issue) => issue.code === "equal_invariant_packages",
        ),
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
    if (!result.valid) expect(result.issues[0]?.code).toBe("secret_value");
  });

  it("rejects malformed PURLs", () => {
    expect(
      validatePurl({ type: "npm", name: "@scope/pkg", version: "1.0.0" }).valid,
    ).toBe(true);
    expect(
      validatePurl({ type: "npm", name: "bad value", version: "1.0.0" }).valid,
    ).toBe(false);
  });

  it("validates the other declarative documents", () => {
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

  it("validates one language artifact independently", () => {
    expect(
      validateLanguageArtifact(validRegistry.languages.javascript).valid,
    ).toBe(true);
  });
});
