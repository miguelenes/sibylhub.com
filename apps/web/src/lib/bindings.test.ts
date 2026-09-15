import { describe, expect, it } from "vitest";
import { localDoubles, readRuntimeBindings } from "./bindings";

describe("binding interfaces", () => {
  it("provide deterministic local doubles", async () => {
    expect(await localDoubles.db.all()).toEqual([]);
    expect(await localDoubles.astStorage.read("missing")).toBeNull();
    expect(await localDoubles.vectorize.search([0])).toEqual([]);
  });

  it("treat absent Cloudflare bindings as optional", async () => {
    await expect(readRuntimeBindings()).resolves.toEqual({
      databaseAvailable: false,
      astStorageAvailable: false,
      vectorizeAvailable: false,
    });
  });
});
