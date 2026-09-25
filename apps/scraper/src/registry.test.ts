import { describe, expect, it } from "vitest";
import type { ScraperConfig } from "./config.js";
import { executeRun } from "./cli.js";
import { AdapterRegistry, type RegistryAdapter } from "./adapters.js";
import { createDefaultRegistry } from "./registry.js";

const config = {
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
    maxAttempts: 1,
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
} satisfies ScraperConfig;

describe("default adapter registry", () => {
  it("registers the five registry adapters and curated source", () => {
    const registry = createDefaultRegistry(config);

    expect(registry.list().map((adapter) => adapter.sourceId)).toEqual([
      "crates",
      "go",
      "libs-tech",
      "npm",
      "packagist",
      "pypi",
    ]);
  });

  it("deduplicates candidates by canonical identity across sources", async () => {
    const details = {
      sourceId: "npm",
      ecosystem: "javascript",
      packageName: "react",
      purl: { type: "npm", name: "react", version: "managed" },
      evidenceIds: ["evidence-react"],
      rank: { sourceId: "npm", basis: "source-ranked" as const },
    };
    const makeAdapter = (sourceId: string): RegistryAdapter => ({
      sourceId,
      ecosystem: "javascript",
      async fetchTopPackages() {
        return [{ ...details, sourceId, rank: { ...details.rank, sourceId } }];
      },
      async fetchPackageDetails(summary) {
        return summary;
      },
      detectFrameworks() {
        return [];
      },
    });
    const summary = await executeRun({
      ecosystems: ["npm", "npm-copy"],
      limit: 1,
      concurrency: 1,
      strict: false,
      json: true,
      config,
      registry: new AdapterRegistry([
        makeAdapter("npm"),
        makeAdapter("npm-copy"),
      ]),
    });

    expect(summary.counts.discovered).toBe(2);
    expect(summary.counts.deduplicated).toBe(1);
    expect(summary.counts.normalized).toBe(1);
  });
});
