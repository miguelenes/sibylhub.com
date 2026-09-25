import { describe, expect, it } from "vitest";
import type { ScraperConfig } from "./config.js";
import { executeRun, normalizeEcosystems, renderSummary } from "./cli.js";
import { AdapterRegistry, type RegistryAdapter } from "./adapters.js";

const config: ScraperConfig = {
  userAgent: "test-agent",
  artifactDir: ".artifacts/scraper",
  sources: {
    npm: "https://registry.npmjs.org",
    packagist: "https://repo.packagist.org",
    pypi: "https://pypi.org",
    crates: "https://crates.io",
    goProxy: "https://proxy.golang.org",
    pkgGoDev: "https://pkg.go.dev",
    libsTech: "https://libs.tech",
  },
  limits: {
    limit: 10,
    concurrency: 2,
    timeoutMs: 1000,
    maxAttempts: 2,
    maxRetryDelayMs: 0,
    maxPageBytes: 1000,
    maxArtifactBytes: 10000,
    maxBatchSize: 10,
  },
  sync: { enabled: false },
  firecrawl: {
    enabled: false,
    allowedHosts: [],
    maxRequests: 1,
    maxPageBytes: 1000,
    timeoutMs: 1000,
  },
};

const adapter: RegistryAdapter = {
  sourceId: "npm",
  ecosystem: "typescript",
  async fetchTopPackages() {
    return [
      {
        sourceId: "npm",
        ecosystem: "typescript",
        packageName: "react",
        purl: { type: "npm", name: "react", version: "managed" },
        evidenceIds: ["evidence-react"],
        rank: { sourceId: "npm", basis: "source-ranked", position: 1 },
      },
    ];
  },
  async fetchPackageDetails(summary) {
    return summary;
  },
  detectFrameworks() {
    return [
      {
        kind: "framework",
        name: "React",
        confidence: "high",
        classifierVersion: "test-1",
        rationale: "Package name",
        evidenceIds: ["evidence-react"],
      },
    ];
  },
};

describe("scraper CLI", () => {
  it("maps language aliases and aggregate selection to sources", () => {
    expect(normalizeEcosystems("typescript,python,rust")).toEqual([
      "npm",
      "pypi",
      "crates",
    ]);
    expect(normalizeEcosystems("all")).toEqual([
      "npm",
      "packagist",
      "pypi",
      "crates",
      "go",
      "libs-tech",
    ]);
  });

  it("returns framework statistics and a successful exit for valid candidates", async () => {
    const summary = await executeRun({
      ecosystems: ["npm"],
      limit: 10,
      concurrency: 2,
      strict: false,
      json: true,
      config,
      registry: new AdapterRegistry([adapter]),
    });

    expect(summary.exitCode).toBe(0);
    expect(summary.counts.normalized).toBe(1);
    expect(summary.frameworks).toEqual({ React: 1 });
  });

  it("renders stable JSON without terminal control sequences", async () => {
    const summary = await executeRun({
      ecosystems: ["npm"],
      limit: 10,
      concurrency: 2,
      strict: false,
      json: true,
      config,
      registry: new AdapterRegistry([adapter]),
    });
    const output = renderSummary(summary, false);

    expect(output).toMatchObject({ status: "success" });
    expect(JSON.stringify(output)).not.toMatch(/\u001b\[/);
  });

  it("uses strict mode to fail partial source runs", async () => {
    const summary = await executeRun({
      ecosystems: ["npm", "nuget"],
      limit: 10,
      concurrency: 2,
      strict: true,
      json: true,
      config,
      registry: new AdapterRegistry([adapter]),
    });

    expect(summary.exitCode).toBe(1);
    expect(summary.sources.nuget?.status).toBe("unsupported");
  });
});
