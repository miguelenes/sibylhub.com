import { HttpClient } from "./http.js";

export type FirecrawlSettings = {
  enabled: boolean;
  endpoint?: string;
  token?: string;
  allowedHosts: string[];
  maxRequests: number;
  maxPageBytes: number;
  timeoutMs: number;
};

export type FirecrawlResult =
  | { status: "disabled" | "rejected" | "failed"; url: string; reason: string }
  | { status: "success"; url: string; markdown: string };

export class FirecrawlClient {
  private requestCount = 0;
  private readonly http: HttpClient;

  constructor(private readonly settings: FirecrawlSettings) {
    this.http = new HttpClient({
      userAgent: "sibylhub-scraper/0.1",
      timeoutMs: settings.timeoutMs,
      maxAttempts: 2,
      maxRetryDelayMs: 1000,
      concurrency: 1,
      maxPageBytes: settings.maxPageBytes,
    });
  }

  private isAllowed(url: string): boolean {
    const hostname = new URL(url).hostname.toLowerCase();
    return this.settings.allowedHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
  }

  async enrich(url: string): Promise<FirecrawlResult> {
    if (!this.settings.enabled)
      return { status: "disabled", url, reason: "disabled" };
    try {
      if (!this.isAllowed(url))
        return { status: "rejected", url, reason: "host_not_allowlisted" };
    } catch {
      return { status: "rejected", url, reason: "invalid_url" };
    }
    if (this.requestCount >= this.settings.maxRequests)
      return { status: "rejected", url, reason: "request_budget_exhausted" };
    if (!this.settings.endpoint || !this.settings.token)
      return { status: "rejected", url, reason: "configuration_incomplete" };
    this.requestCount += 1;
    try {
      const response = await this.http.requestJson<{
        success?: boolean;
        data?: { markdown?: string };
      }>({
        sourceId: "firecrawl",
        requestClass: "scrape",
        url: `${this.settings.endpoint.replace(/\/$/, "")}/v1/scrape`,
        method: "POST",
        headers: {
          authorization: `Bearer ${this.settings.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });
      const markdown = response.data.data?.markdown;
      if (!response.data.success || typeof markdown !== "string")
        return { status: "failed", url, reason: "invalid_provider_response" };
      if (
        new TextEncoder().encode(markdown).byteLength >
        this.settings.maxPageBytes
      )
        return { status: "rejected", url, reason: "page_budget_exhausted" };
      return { status: "success", url, markdown };
    } catch {
      return { status: "failed", url, reason: "provider_request_failed" };
    }
  }
}
