import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "./bindings";

const { workersEnv } = vi.hoisted(() => ({
  workersEnv: {} as RuntimeEnv,
}));

vi.mock("cloudflare:workers", () => ({
  env: workersEnv,
}));

import { GET } from "../pages/api/project/context";
import { readProjectContext } from "./context-service";

const snapshot = {
  project_id: "demo-project",
  project_name: "Demo project",
  source_revision: "sha256:demo",
  context_ceiling_tokens: 100,
  rules_used_tokens: 10,
  memories_used_tokens: 15,
  ast_used_tokens: 35,
  active_used_tokens: 30,
  tools_used_tokens: 10,
  rtk_savings: null,
  snapshot_status: "ready",
};

const dependencies = [
  {
    dependency_id: "dep-api-client",
    package_name: "@sibylhub/api-client",
    package_version: "0.1.0",
    purl_json: JSON.stringify({
      type: "npm",
      namespace: "sibylhub",
      name: "api-client",
      version: "0.1.0",
    }),
    runtime: "typescript",
    package_manager: "pnpm",
    evidence_json: JSON.stringify(["workspace manifest"]),
    snapshot_revision: "sha256:demo",
    policy_state: "compliant",
    invariant_name: null,
    invariant_severity: null,
    invariant_reason: null,
    approved_replacement: null,
  },
];

function database(options: { missing?: boolean; invalid?: boolean } = {}) {
  return {
    prepare(_query: string) {
      return {
        bind() {
          return this;
        },
        async first<T>() {
          if (options.missing) return null;
          if (options.invalid)
            return { ...snapshot, context_ceiling_tokens: -1 } as T;
          return snapshot as T;
        },
        async all<T>() {
          return { results: dependencies as T[] };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
}

function resetWorkersEnv(next: RuntimeEnv = {}) {
  for (const key of Object.keys(workersEnv)) {
    delete workersEnv[key as keyof RuntimeEnv];
  }
  Object.assign(workersEnv, next);
}

beforeEach(() => {
  resetWorkersEnv();
});

describe("project context service", () => {
  it("returns a deterministic local snapshot without Rust or Cloudflare bindings", async () => {
    const result = await readProjectContext({});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.source).toBe("local");
      expect(Object.keys(result.data.budget.partitions)).toEqual([
        "rules",
        "memories",
        "ast",
        "active",
        "tools",
      ]);
      expect(
        Object.values(result.data.budget.partitions).reduce(
          (total, partition) => total + partition.allocatedTokens,
          0,
        ),
      ).toBe(result.data.budget.ceilingTokens);
    }
  });

  it("reads precomputed D1 evidence and applies the shared budget contract", async () => {
    const result = await readProjectContext(
      { DB: database() },
      undefined,
      "demo-project",
    );

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.data.source).toBe("d1");
      expect(result.data.sourceRevision).toBe("sha256:demo");
      expect(result.data.budget.rtkSavingsIsDefault).toBe(true);
      expect(result.data.dependencies[0]?.policy).toBe("compliant");
      expect(result.data.dependencies[0]?.invariant).toBeUndefined();
    }
  });

  it("fails closed for missing projects and malformed D1 rows", async () => {
    await expect(
      readProjectContext({ DB: database({ missing: true }) }, "demo-project"),
    ).resolves.toEqual({ ok: false, kind: "not_found" });
    await expect(
      readProjectContext({ DB: database({ invalid: true }) }, "demo-project"),
    ).resolves.toEqual({ ok: false, kind: "unavailable" });
  });
});

describe("GET /api/project/context", () => {
  it("returns five partitions and stable local data", async () => {
    const response = await GET({
      url: new URL("https://sibylhub.test/api/project/context"),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("local");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects malformed selection and reports unknown local projects safely", async () => {
    const malformed = await GET({
      url: new URL(
        "https://sibylhub.test/api/project/context?project_id=not%20safe",
      ),
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });

    const unknown = await GET({
      url: new URL(
        "https://sibylhub.test/api/project/context?project_id=other-project",
      ),
    });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({
      error: { code: "PROJECT_CONTEXT_NOT_FOUND" },
    });
  });

  it("maps configured-source failures to a safe 503 response", async () => {
    resetWorkersEnv({
      DB: database({ invalid: true }),
      SIBYL_ACTIVE_PROJECT_ID: "demo-project",
    });
    const unavailable = await GET({
      url: new URL("https://sibylhub.test/api/project/context"),
    });

    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: { code: "PROJECT_CONTEXT_UNAVAILABLE" },
    });
  });
});
