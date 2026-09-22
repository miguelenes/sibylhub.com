import { afterEach, describe, expect, it, vi } from "vitest";
import { FirecrawlClient } from "./firecrawl.js";

afterEach(() => vi.unstubAllGlobals());

const enabled = {
  enabled: true,
  endpoint: "https://firecrawl.example.test",
  token: "firecrawl-secret",
  allowedHosts: ["libs.tech"],
  maxRequests: 1,
  maxPageBytes: 1000,
  timeoutMs: 1000,
};

describe("Firecrawl enrichment", () => {
  it("does not contact Firecrawl when disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new FirecrawlClient({ ...enabled, enabled: false });

    await expect(
      client.enrich("https://libs.tech/react"),
    ).resolves.toMatchObject({ status: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed for hosts outside the allowlist", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new FirecrawlClient(enabled);

    await expect(
      client.enrich("https://example.test/react"),
    ).resolves.toMatchObject({ status: "rejected" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns bounded markdown for an allowlisted page", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ success: true, data: { markdown: "# React" } }),
            { status: 200 },
          ),
        ),
    );
    const client = new FirecrawlClient(enabled);

    await expect(
      client.enrich("https://libs.tech/react"),
    ).resolves.toMatchObject({
      status: "success",
      markdown: "# React",
    });
  });

  it("redacts provider failures and enforces request budgets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("provider down", { status: 503 })),
    );
    const client = new FirecrawlClient(enabled);

    const first = await client.enrich("https://libs.tech/react");
    const second = await client.enrich("https://libs.tech/vue");

    expect(first.status).toBe("failed");
    expect(JSON.stringify(first)).not.toContain("firecrawl-secret");
    expect(second.status).toBe("rejected");
  });
});
