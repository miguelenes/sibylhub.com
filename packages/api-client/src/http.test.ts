import { describe, expect, it, vi } from "vitest";
import { getProjectContext, queryMemory } from "./http";

describe("safe HTTP helpers", () => {
  it("does not call the network for invalid memory input", async () => {
    const fetcher = vi.fn();
    const result = await queryMemory(
      { query: "shell: rm -rf", limit: 20 },
      { fetcher },
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends no credentials and preserves the route contract", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.credentials).toBe("omit");
        expect(init?.cache).toBe("no-store");
        return new Response(
          JSON.stringify({ schemaVersion: "1.0", source: "local" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );
    const result = await getProjectContext({ projectId: "local", fetcher });
    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/project/context?project_id=local",
      expect.any(Object),
    );
  });
});
