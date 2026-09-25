import type { ScraperConfig } from "./config.js";
import { HttpClient } from "./http.js";
import {
  CratesAdapter,
  GoAdapter,
  NpmAdapter,
  PackagistAdapter,
  PyPIAdapter,
} from "./registry-adapters.js";
import { AdapterRegistry } from "./adapters.js";
import { LibsTechAdapter } from "./libs-tech.js";

export function createDefaultRegistry(config: ScraperConfig): AdapterRegistry {
  const http = new HttpClient({
    userAgent: config.userAgent,
    timeoutMs: config.limits.timeoutMs,
    maxAttempts: config.limits.maxAttempts,
    maxRetryDelayMs: config.limits.maxRetryDelayMs,
    concurrency: config.limits.concurrency,
    maxPageBytes: config.limits.maxPageBytes,
  });
  return new AdapterRegistry([
    new NpmAdapter(http, config.sources.npm),
    new PackagistAdapter(http, config.sources.packagist),
    new PyPIAdapter(http, config.sources.pypi),
    new CratesAdapter(http, config.sources.crates),
    new GoAdapter(http, config.sources.goProxy, config.sources.pkgGoDev),
    new LibsTechAdapter(http, config.sources.libsTech),
  ]);
}
