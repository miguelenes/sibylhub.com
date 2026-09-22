import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "./http.js";
import { LibsTechAdapter } from "./libs-tech.js";

afterEach(() => vi.unstubAllGlobals());

describe("libs.tech adapter", () => {
  it("extracts curated observations without flattening their source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            `<main>
              <h1>React</h1>
              <div data-field="category"><a>Frontend</a></div>
              <div data-field="alternative"><a>Preact</a></div>
              <div data-field="comparison"><a>React vs Vue</a></div>
              <div data-field="pro">Large ecosystem</div>
              <div data-field="con">Client-side runtime</div>
              <div data-field="opinion">Popular choice</div>
              <a data-field="repository" href="https://github.com/facebook/react">Repository</a>
              <span data-field="license">MIT</span>
              <span data-field="stars">228000</span>
            </main>`,
            { status: 200 },
          ),
        ),
      ),
    );
    const adapter = new LibsTechAdapter(
      new HttpClient({
        userAgent: "test",
        timeoutMs: 1000,
        maxAttempts: 1,
        maxRetryDelayMs: 0,
        concurrency: 1,
        maxPageBytes: 10000,
      }),
      "https://libs.tech",
      ["https://libs.tech/react"],
    );

    const [summary] = await adapter.fetchTopPackages(1, { limit: 1 });
    const details = await adapter.fetchPackageDetails(summary!);
    const candidate = adapter.normalizeCuratedCandidate(details);

    expect(candidate.purl.type).toBe("generic");
    expect(candidate.observations?.map((item) => item.kind)).toEqual([
      "category",
      "alternative",
      "comparison",
      "pro",
      "con",
      "opinion",
      "repository",
      "license",
      "stars",
    ]);
    expect(
      candidate.observations?.every((item) => item.sourceId === "libs-tech"),
    ).toBe(true);
    expect(
      candidate.observations?.find((item) => item.kind === "stars")?.value,
    ).toBe("228000");
  });
});
