import { describe, expect, it } from "vitest";
import { loadScraperConfig, summarizeConfig } from "./config.js";

describe("scraper configuration", () => {
  it("keeps remote synchronization and Firecrawl disabled by default", () => {
    const config = loadScraperConfig({});

    expect(config.sync.enabled).toBe(false);
    expect(config.firecrawl.enabled).toBe(false);
    expect(config.limits.concurrency).toBe(5);
    expect(config.artifactDir).toBe(".artifacts/scraper");
  });

  it("requires complete synchronization configuration when enabled", () => {
    expect(() =>
      loadScraperConfig({
        SCRAPER_SYNC_ENABLED: "true",
        SCRAPER_API_URL:
          "https://backoffice.example.test/api/v1/ingest/packages",
      }),
    ).toThrow(/synchronization.*token/i);
  });

  it("requires an allowlisted host when Firecrawl is enabled", () => {
    expect(() =>
      loadScraperConfig({
        SCRAPER_FIRECRAWL_ENABLED: "true",
        SCRAPER_FIRECRAWL_ENDPOINT: "https://firecrawl.example.test",
        SCRAPER_FIRECRAWL_TOKEN: "firecrawl-secret",
      }),
    ).toThrow(/allowlist/i);
  });

  it("redacts credentials from configuration summaries", () => {
    const config = loadScraperConfig({
      SCRAPER_SYNC_ENABLED: "true",
      SCRAPER_API_URL: "https://backoffice.example.test/api/v1/ingest/packages",
      SCRAPER_API_TOKEN: "sync-secret",
      SCRAPER_FIRECRAWL_ENABLED: "true",
      SCRAPER_FIRECRAWL_ENDPOINT: "https://firecrawl.example.test",
      SCRAPER_FIRECRAWL_TOKEN: "firecrawl-secret",
      SCRAPER_FIRECRAWL_ALLOWED_HOSTS: "libs.tech",
    });
    const summary = JSON.stringify(summarizeConfig(config));

    expect(summary).not.toContain("sync-secret");
    expect(summary).not.toContain("firecrawl-secret");
    expect(summary).toContain("libs.tech");
  });
});
