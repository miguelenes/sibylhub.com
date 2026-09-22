import { describe, expect, it } from "vitest";
import type { PackageCandidate, Purl } from "@sibylhub/schemas";
import {
  AdapterRegistry,
  normalizePackageCandidate,
  type PackageDetails,
  type RegistryAdapter,
} from "./adapters.js";

const purl: Purl = {
  type: "npm",
  namespace: "@types",
  name: "react",
  version: "managed",
};

const details: PackageDetails = {
  sourceId: "npm",
  ecosystem: "typescript",
  packageName: "react",
  namespace: "@types",
  purl,
  releaseVersion: "19.1.0",
  description: "User interface library",
  keywords: ["react"],
  evidenceIds: ["evidence-react"],
  rank: { sourceId: "npm", basis: "source-ranked", position: 1, seed: "react" },
};

const adapter: RegistryAdapter = {
  sourceId: "npm",
  ecosystem: "typescript",
  async fetchTopPackages() {
    return [details];
  },
  async fetchPackageDetails(summary) {
    return summary;
  },
  detectFrameworks() {
    return [];
  },
};

describe("registry adapters", () => {
  it("normalizes adapter details into a canonical candidate", () => {
    const candidate = normalizePackageCandidate(details);

    expect(candidate.candidateId).toBe("pkg:npm/%40types/react@managed");
    expect(candidate.namespace).toBe("@types");
    expect(candidate.releaseVersion).toBe("19.1.0");
    expect(candidate.evidenceIds).toEqual(["evidence-react"]);
  });

  it("registers substitutable adapters and rejects duplicate sources", () => {
    const registry = new AdapterRegistry([adapter]);

    expect(registry.get("npm")).toBe(adapter);
    expect(() => registry.register(adapter)).toThrow(/already registered/i);
  });

  it("reports requested ecosystems without an adapter as unsupported", () => {
    const registry = new AdapterRegistry([adapter]);
    const result = registry.resolve(["npm", "nuget"]);

    expect(result.supported).toEqual([adapter]);
    expect(result.unsupported).toEqual([
      { sourceId: "nuget", reason: "No adapter is registered" },
    ]);
  });

  it("preserves explicit adapter metadata while normalizing", () => {
    const candidate: PackageCandidate = normalizePackageCandidate({
      ...details,
      homepageUrl: "https://react.dev",
      repositoryUrl: "https://github.com/facebook/react",
      license: "MIT",
    });

    expect(candidate.homepageUrl).toBe("https://react.dev/");
    expect(candidate.repositoryUrl).toBe("https://github.com/facebook/react");
    expect(candidate.license).toBe("MIT");
  });
});
