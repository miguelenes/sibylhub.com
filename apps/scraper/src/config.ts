export type ScraperEnv = Record<string, string | undefined>;

export type ScraperLimits = {
  limit: number;
  concurrency: number;
  timeoutMs: number;
  maxAttempts: number;
  maxRetryDelayMs: number;
  maxPageBytes: number;
  maxArtifactBytes: number;
  maxBatchSize: number;
};

export type SourceUrls = {
  npm: string;
  packagist: string;
  pypi: string;
  crates: string;
  goProxy: string;
  pkgGoDev: string;
  libsTech: string;
};

export type ScraperConfig = {
  userAgent: string;
  artifactDir: string;
  sources: SourceUrls;
  limits: ScraperLimits;
  sync: { enabled: boolean; url?: string; token?: string };
  firecrawl: {
    enabled: boolean;
    endpoint?: string;
    token?: string;
    allowedHosts: string[];
    maxRequests: number;
    maxPageBytes: number;
    timeoutMs: number;
  };
};

const defaults: SourceUrls = {
  npm: "https://registry.npmjs.org",
  packagist: "https://repo.packagist.org",
  pypi: "https://pypi.org",
  crates: "https://crates.io",
  goProxy: "https://proxy.golang.org",
  pkgGoDev: "https://pkg.go.dev",
  libsTech: "https://libs.tech",
};

function bool(env: ScraperEnv, name: string, fallback: boolean): boolean {
  const value = env[name];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean configuration for ${name}`);
}

function integer(
  env: ScraperEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`Invalid bounded integer configuration for ${name}`);
  return value;
}

function urlValue(env: ScraperEnv, name: string, fallback: string): string {
  const value = env[name] ?? fallback;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid URL configuration for ${name}`);
  }
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password)
    throw new Error(`Unsafe URL configuration for ${name}`);
  if (/[?&](token|secret|password|authorization)=/i.test(parsed.search))
    throw new Error(`Secret-bearing URL configuration for ${name}`);
  return parsed.toString().replace(/\/$/, "");
}

function secret(env: ScraperEnv, name: string): string {
  const value = env[name];
  if (!value || /\s/.test(value)) throw new Error(`Missing or unsafe ${name}`);
  return value;
}

function hosts(env: ScraperEnv): string[] {
  const value = env.SCRAPER_FIRECRAWL_ALLOWED_HOSTS ?? "";
  const parsed = value
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (!parsed.length || parsed.some((host) => !/^[a-z0-9.-]+$/.test(host)))
    throw new Error(
      "Firecrawl host allowlist is required and must contain hostnames",
    );
  return [...new Set(parsed)];
}

export function loadScraperConfig(
  env: ScraperEnv = process.env,
): ScraperConfig {
  const syncEnabled = bool(env, "SCRAPER_SYNC_ENABLED", false);
  const syncUrl = syncEnabled
    ? urlValue(
        env,
        "SCRAPER_API_URL",
        "https://localhost.invalid/api/v1/ingest/packages",
      )
    : undefined;
  if (syncEnabled && !env.SCRAPER_API_TOKEN)
    throw new Error("Synchronization configuration requires a token");
  const syncToken = syncEnabled ? secret(env, "SCRAPER_API_TOKEN") : undefined;
  const firecrawlEnabled = bool(env, "SCRAPER_FIRECRAWL_ENABLED", false);
  const firecrawlEndpoint = firecrawlEnabled
    ? urlValue(env, "SCRAPER_FIRECRAWL_ENDPOINT", "")
    : undefined;
  const firecrawlToken = firecrawlEnabled
    ? secret(env, "SCRAPER_FIRECRAWL_TOKEN")
    : undefined;
  const firecrawlHosts = firecrawlEnabled ? hosts(env) : [];

  return {
    userAgent: env.SCRAPER_USER_AGENT?.trim() || "sibylhub-scraper/0.1",
    artifactDir: env.SCRAPER_ARTIFACT_DIR?.trim() || ".artifacts/scraper",
    sources: {
      npm: urlValue(env, "SCRAPER_NPM_URL", defaults.npm),
      packagist: urlValue(env, "SCRAPER_PACKAGIST_URL", defaults.packagist),
      pypi: urlValue(env, "SCRAPER_PYPI_URL", defaults.pypi),
      crates: urlValue(env, "SCRAPER_CRATES_URL", defaults.crates),
      goProxy: urlValue(env, "SCRAPER_GO_PROXY_URL", defaults.goProxy),
      pkgGoDev: urlValue(env, "SCRAPER_PKG_GO_DEV_URL", defaults.pkgGoDev),
      libsTech: urlValue(env, "SCRAPER_LIBS_TECH_URL", defaults.libsTech),
    },
    limits: {
      limit: integer(env, "SCRAPER_LIMIT", 100, 1, 10000),
      concurrency: integer(env, "SCRAPER_CONCURRENCY", 5, 1, 50),
      timeoutMs: integer(env, "SCRAPER_TIMEOUT_MS", 15000, 100, 120000),
      maxAttempts: integer(env, "SCRAPER_MAX_ATTEMPTS", 4, 1, 8),
      maxRetryDelayMs: integer(
        env,
        "SCRAPER_MAX_RETRY_DELAY_MS",
        30000,
        0,
        120000,
      ),
      maxPageBytes: integer(
        env,
        "SCRAPER_MAX_PAGE_BYTES",
        1_000_000,
        1024,
        10_000_000,
      ),
      maxArtifactBytes: integer(
        env,
        "SCRAPER_MAX_ARTIFACT_BYTES",
        20_000_000,
        1024,
        100_000_000,
      ),
      maxBatchSize: integer(env, "SCRAPER_MAX_BATCH_SIZE", 100, 1, 1000),
    },
    sync: { enabled: syncEnabled, url: syncUrl, token: syncToken },
    firecrawl: {
      enabled: firecrawlEnabled,
      endpoint: firecrawlEndpoint,
      token: firecrawlToken,
      allowedHosts: firecrawlHosts,
      maxRequests: integer(env, "SCRAPER_FIRECRAWL_MAX_REQUESTS", 25, 1, 100),
      maxPageBytes: integer(
        env,
        "SCRAPER_FIRECRAWL_MAX_PAGE_BYTES",
        500_000,
        1024,
        5_000_000,
      ),
      timeoutMs: integer(
        env,
        "SCRAPER_FIRECRAWL_TIMEOUT_MS",
        20000,
        100,
        120000,
      ),
    },
  };
}

export function summarizeConfig(config: ScraperConfig): Omit<
  ScraperConfig,
  "sync" | "firecrawl"
> & {
  sync: { enabled: boolean; url?: string; configured: boolean };
  firecrawl: {
    enabled: boolean;
    endpoint?: string;
    allowedHosts: string[];
    configured: boolean;
  };
} {
  return {
    userAgent: config.userAgent,
    artifactDir: config.artifactDir,
    sources: config.sources,
    limits: config.limits,
    sync: {
      enabled: config.sync.enabled,
      url: config.sync.url,
      configured: Boolean(config.sync.token),
    },
    firecrawl: {
      enabled: config.firecrawl.enabled,
      endpoint: config.firecrawl.endpoint,
      allowedHosts: config.firecrawl.allowedHosts,
      configured: Boolean(config.firecrawl.token),
    },
  };
}
