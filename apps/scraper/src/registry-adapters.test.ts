import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "./http.js";
import {
  CratesAdapter,
  GoAdapter,
  NpmAdapter,
  PackagistAdapter,
  PyPIAdapter,
} from "./registry-adapters.js";

const http = () =>
  new HttpClient({
    userAgent: "sibylhub-test",
    timeoutMs: 1000,
    maxAttempts: 1,
    maxRetryDelayMs: 0,
    concurrency: 2,
    maxPageBytes: 1_000_000,
  });

afterEach(() => vi.unstubAllGlobals());

describe("registry adapters", () => {
  it("paginates and deduplicates npm search results while preserving scopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const from = new URL(url).searchParams.get("from");
        return Promise.resolve(
          new Response(
            JSON.stringify({
              objects:
                from === "0"
                  ? [
                      {
                        package: {
                          name: "@types/react",
                          version: "19.1.0",
                          description: "React types",
                        },
                      },
                      { package: { name: "react", version: "19.1.0" } },
                    ]
                  : [
                      { package: { name: "@types/react", version: "19.1.0" } },
                      { package: { name: "preact", version: "10.0.0" } },
                    ],
            }),
            { status: 200 },
          ),
        );
      }),
    );
    const adapter = new NpmAdapter(http(), "https://registry.npmjs.org");

    const results = await adapter.fetchTopPackages(3, { limit: 3 });

    expect(results.map((result) => result.purl.name)).toEqual([
      "react",
      "react",
      "preact",
    ]);
    expect(results[0]?.purl.namespace).toBe("@types");
    expect(results[0]?.rank.basis).toBe("source-ranked");
  });

  it("normalizes Packagist vendor names into Composer PURLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                name: "symfony/console",
                description: "Console",
                repository: "https://github.com/symfony/console",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const adapter = new PackagistAdapter(http(), "https://repo.packagist.org");

    const [result] = await adapter.fetchTopPackages(1, { limit: 1 });

    expect(result?.purl).toMatchObject({
      type: "composer",
      namespace: "symfony",
      name: "console",
      version: "managed",
    });
    expect(result?.rank.basis).toBe("seed-ranked");
  });

  it("uses maintained PyPI seeds instead of claiming a global ranking", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response("<html></html>", { status: 200 })),
        ),
    );
    const adapter = new PyPIAdapter(http(), "https://pypi.org");

    const results = await adapter.fetchTopPackages(2, { limit: 2 });

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.rank.basis === "seed-ranked")).toBe(
      true,
    );
    expect(results[0]?.rank.seed).toBeTruthy();
  });

  it("reports crates.io download-ranked results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            crates: [
              {
                name: "tokio",
                max_version: "1.0.0",
                downloads: 1000,
                recent_downloads: 100,
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const adapter = new CratesAdapter(http(), "https://crates.io");

    const [result] = await adapter.fetchTopPackages(1, { limit: 1 });

    expect(result?.purl.type).toBe("cargo");
    expect(result?.rank.basis).toBe("global");
    expect(result?.downloads?.[0]?.value).toBe(100);
  });

  it("preserves Go module paths and marks them as seed-ranked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("v1.2.3\n", { status: 200 })),
    );
    const adapter = new GoAdapter(
      http(),
      "https://proxy.golang.org",
      "https://pkg.go.dev",
      ["github.com/labstack/echo/v4"],
    );

    const [result] = await adapter.fetchTopPackages(1, { limit: 1 });

    expect(result?.purl).toMatchObject({
      type: "golang",
      namespace: "github.com/labstack",
      name: "echo/v4",
    });
    expect(result?.rank.basis).toBe("seed-ranked");
  });
});
