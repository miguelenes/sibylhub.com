import { describe, expect, it } from "vitest";
import { scraperPackageName } from "./index.js";

describe("scraper package", () => {
  it("has the private workspace package identity", () => {
    expect(scraperPackageName).toBe("@sibylhub/scraper");
  });
});
