import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient, HttpError } from "./http.js";

afterEach(() => vi.unstubAllGlobals());

const client = () =>
  new HttpClient({
    userAgent: "test-agent",
    timeoutMs: 1000,
    maxAttempts: 3,
    maxRetryDelayMs: 0,
    concurrency: 1,
    maxPageBytes: 100,
  });

describe("source HTTP client", () => {
  it("retries a 429 response within the bounded retry budget", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", {
          status: 429,
          headers: { "Retry-After": "0" },
        }),
      )
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().requestJson<{ ok: boolean }>({
      sourceId: "npm",
      requestClass: "search",
      url: "https://registry.npmjs.org/-/v1/search",
    });

    expect(result.data.ok).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("retries transient 5xx failures and preserves source telemetry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().requestText({
      sourceId: "pypi",
      requestClass: "detail",
      url: "https://pypi.org/pypi/example/json",
    });

    expect(result.data).toBe("ok");
    expect(result.sourceId).toBe("pypi");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent not-found failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      client().requestText({
        sourceId: "crates",
        requestClass: "detail",
        url: "https://crates.io/api/v1/crates/missing",
      }),
    ).rejects.toMatchObject({ code: "permanent_not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies timeout and oversized responses without exposing URL secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(
      client().requestText({
        sourceId: "go",
        requestClass: "detail",
        url: "https://proxy.golang.org/module?token=do-not-log",
      }),
    ).rejects.toBeInstanceOf(HttpError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("x".repeat(101), { status: 200 })),
    );
    await expect(
      client().requestText({
        sourceId: "go",
        requestClass: "detail",
        url: "https://proxy.golang.org/module",
      }),
    ).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("isolates queues by source", async () => {
    let release!: (response: Response) => void;
    const blocked = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn((url: string) =>
      url.includes("npm")
        ? blocked
        : Promise.resolve(new Response("pypi", { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const isolatedClient = client();

    const npmRequest = isolatedClient.requestText({
      sourceId: "npm",
      requestClass: "detail",
      url: "https://registry.npmjs.org/blocked",
    });
    await expect(
      isolatedClient.requestText({
        sourceId: "pypi",
        requestClass: "detail",
        url: "https://pypi.org/pypi/example/json",
      }),
    ).resolves.toMatchObject({ data: "pypi" });
    release(new Response("npm", { status: 200 }));
    await expect(npmRequest).resolves.toMatchObject({ data: "npm" });
  });
});
