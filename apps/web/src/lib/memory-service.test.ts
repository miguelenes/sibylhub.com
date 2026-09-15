import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeBindings, RuntimeEnv } from "./bindings";

const { workersEnv } = vi.hoisted(() => ({
  workersEnv: {} as RuntimeEnv,
}));

vi.mock("cloudflare:workers", () => ({
  env: workersEnv,
}));

import { POST } from "../pages/api/memory/query";
import { queryMemory } from "./memory-service";

const metadataRow = {
  memory_id: "memory-architecture",
  vectorize_id: "memory-architecture",
  title: "Server-first web rendering",
  category: "architecture",
  content_preview: "Astro owns the shell and React owns focused interaction.",
  access_count: 3,
};

function bindings(options: { empty?: boolean } = {}) {
  const calls = { ai: 0, vectorize: 0, prepare: 0, run: 0 };
  const value: RuntimeBindings = {
    AI: {
      async run<T = unknown>(_model: string, _input: unknown): Promise<T> {
        calls.ai += 1;
        return { data: [[0.1, 0.2, 0.3]] } as T;
      },
    },
    VECTORIZE_INDEX: {
      async query() {
        calls.vectorize += 1;
        return options.empty
          ? { matches: [] }
          : { matches: [{ id: "memory-architecture", score: 0.91 }] };
      },
    },
    DB: {
      prepare() {
        calls.prepare += 1;
        return {
          bind() {
            return this;
          },
          async all<T>() {
            return { results: [metadataRow] as T[] };
          },
          async first<T>() {
            return null as T | null;
          },
          async run() {
            calls.run += 1;
            return { success: true };
          },
        };
      },
    },
  };
  return { value, calls };
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

describe("memory service", () => {
  it("rejects unsafe input before calling semantic services", async () => {
    const fixture = bindings();
    const result = await queryMemory(
      { query: "password=not-a-query", projectId: "demo-project" },
      fixture.value,
    );

    expect(result).toEqual({ ok: false, kind: "invalid_request" });
    expect(fixture.calls).toEqual({ ai: 0, vectorize: 0, prepare: 0, run: 0 });
  });

  it("returns a successful empty result only when all semantic services respond", async () => {
    const fixture = bindings({ empty: true });
    const result = await queryMemory(
      { query: "  architecture  ", projectId: "demo-project", limit: 10 },
      fixture.value,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        status: "no_matches",
        query: { normalized: "architecture", wasTrimmed: true },
        matches: [],
      },
    });
    expect(fixture.calls).toMatchObject({ ai: 1, vectorize: 1, prepare: 0 });
  });

  it("hydrates bounded approved metadata and never mutates access counters", async () => {
    const fixture = bindings();
    const result = await queryMemory(
      { query: "architecture", projectId: "demo-project", limit: 1 },
      fixture.value,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        status: "matches",
        matches: [
          {
            id: "memory-architecture",
            similarityScore: 0.91,
            accessCount: 3,
          },
        ],
      },
    });
    expect(fixture.calls).toEqual({ ai: 1, vectorize: 1, prepare: 1, run: 0 });
  });

  it("defaults to unavailable when an approved semantic binding is absent", async () => {
    const fixture = bindings();
    const result = await queryMemory(
      { query: "architecture", projectId: "demo-project" },
      { DB: fixture.value.DB },
    );

    expect(result).toEqual({ ok: false, kind: "unavailable" });
    expect(fixture.calls).toEqual({ ai: 0, vectorize: 0, prepare: 0, run: 0 });
  });
});

describe("POST /api/memory/query", () => {
  it("returns stable 400 and 503 envelopes without leaking request or provider details", async () => {
    const malformed = await POST({
      request: new Request("https://sibylhub.test/api/memory/query", {
        method: "POST",
        body: "{",
      }),
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });

    const unavailable = await POST({
      request: new Request("https://sibylhub.test/api/memory/query", {
        method: "POST",
        body: JSON.stringify({ query: "private architecture query" }),
      }),
    });
    const unavailableBody = await unavailable.json();
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("cache-control")).toBe("private, no-store");
    expect(unavailableBody).toMatchObject({
      error: { code: "MEMORY_SEARCH_UNAVAILABLE" },
    });
    expect(JSON.stringify(unavailableBody)).not.toContain(
      "private architecture query",
    );
  });

  it("returns an explicit empty result when the configured fixture is complete", async () => {
    const fixture = bindings({ empty: true });
    resetWorkersEnv({
      ...fixture.value,
      SIBYL_ACTIVE_PROJECT_ID: "demo-project",
    });
    const response = await POST({
      request: new Request("https://sibylhub.test/api/memory/query", {
        method: "POST",
        body: JSON.stringify({ query: "architecture" }),
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "no_matches",
      matches: [],
    });
  });

  it("maps provider failures to the same safe unavailable contract", async () => {
    const fixture = bindings();
    fixture.value.AI = {
      async run<T = unknown>(_model: string, _input: unknown): Promise<T> {
        throw new Error("provider detail must not escape");
      },
    };
    resetWorkersEnv({
      ...fixture.value,
      SIBYL_ACTIVE_PROJECT_ID: "demo-project",
    });
    const response = await POST({
      request: new Request("https://sibylhub.test/api/memory/query", {
        method: "POST",
        body: JSON.stringify({ query: "architecture" }),
      }),
    });

    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual({
      schemaVersion: "1.0",
      error: {
        code: "MEMORY_SEARCH_UNAVAILABLE",
        message: "Memory search is unavailable",
      },
    });
  });
});
