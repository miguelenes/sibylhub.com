import { load } from "cheerio";
import type { CandidateDownloadObservation, Purl } from "@sibylhub/schemas";
import type {
  DiscoveryOptions,
  PackageDetails,
  RegistryAdapter,
} from "./adapters.js";
import { HttpClient } from "./http.js";

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function evidenceId(sourceId: string, url: string): string {
  return `evidence-${sourceId}-${encodeURIComponent(url).slice(0, 180)}`;
}

function parseScopedName(name: string): {
  namespace?: string;
  packageName: string;
} {
  if (!name.startsWith("@")) return { packageName: name };
  const slash = name.indexOf("/");
  return slash > 0
    ? { namespace: name.slice(0, slash), packageName: name.slice(slash + 1) }
    : { packageName: name };
}

function packageDetails(
  sourceId: string,
  ecosystem: string,
  name: string,
  purl: Purl,
  rank: PackageDetails["rank"],
  sourceUrl: string,
  extra: Partial<PackageDetails> = {},
): PackageDetails {
  return {
    sourceId,
    ecosystem,
    packageName: name,
    purl,
    evidenceIds: [evidenceId(sourceId, sourceUrl)],
    rank,
    ...extra,
  };
}

function urlOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

export class NpmAdapter implements RegistryAdapter {
  readonly sourceId = "npm";
  readonly ecosystem = "javascript";

  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
    private readonly seeds = [
      "react",
      "vue",
      "angular",
      "svelte",
      "express",
      "hono",
    ],
  ) {}

  async fetchTopPackages(
    limit: number,
    options: DiscoveryOptions,
  ): Promise<PackageDetails[]> {
    const results = new Map<string, PackageDetails>();
    const seed = options.seed ?? this.seeds[0];
    let offset = 0;
    while (results.size < limit && offset <= limit * 2) {
      const pageSize = Math.min(100, Math.max(limit, 1));
      const url = `${joinUrl(this.baseUrl, "/-/v1/search")}?text=${encodeURIComponent(seed ?? "")}&size=${pageSize}&from=${offset}`;
      const response = await this.http.requestJson<{
        objects?: Array<{ package?: Record<string, unknown> }>;
      }>({
        sourceId: this.sourceId,
        requestClass: "search",
        url,
      });
      const objects = response.data.objects ?? [];
      if (!objects.length) break;
      for (const [index, object] of objects.entries()) {
        const pkg = object.package;
        if (typeof pkg?.name !== "string") continue;
        const parsed = parseScopedName(pkg.name);
        const detail = packageDetails(
          this.sourceId,
          this.ecosystem,
          pkg.name,
          {
            type: "npm",
            namespace: parsed.namespace,
            name: parsed.packageName,
            version: "managed",
          },
          {
            sourceId: this.sourceId,
            basis: "source-ranked",
            position: results.size + index + 1,
            seed,
          },
          url,
          {
            releaseVersion:
              typeof pkg.version === "string" ? pkg.version : undefined,
            description:
              typeof pkg.description === "string" ? pkg.description : undefined,
            keywords: Array.isArray(pkg.keywords)
              ? pkg.keywords.filter(
                  (value): value is string => typeof value === "string",
                )
              : undefined,
          },
        );
        results.set(
          `${detail.purl.namespace ?? ""}/${detail.purl.name}`,
          detail,
        );
      }
      offset += objects.length;
    }
    return [...results.values()].slice(0, limit);
  }

  async fetchPackageDetails(summary: PackageDetails): Promise<PackageDetails> {
    const url = joinUrl(this.baseUrl, encodeURIComponent(summary.packageName));
    const response = await this.http.requestJson<Record<string, unknown>>({
      sourceId: this.sourceId,
      requestClass: "detail",
      url,
    });
    const latest =
      typeof response.data["dist-tags"] === "object" &&
      response.data["dist-tags"] !== null
        ? (response.data["dist-tags"] as Record<string, unknown>).latest
        : undefined;
    const parsed = parseScopedName(summary.packageName);
    return {
      ...summary,
      purl: {
        type: "npm",
        namespace: parsed.namespace,
        name: parsed.packageName,
        version: "managed",
      },
      namespace: parsed.namespace,
      releaseVersion:
        typeof latest === "string" ? latest : summary.releaseVersion,
      homepageUrl: urlOrUndefined(response.data.homepage),
      repositoryUrl: urlOrUndefined(
        typeof response.data.repository === "object" &&
          response.data.repository !== null
          ? (response.data.repository as Record<string, unknown>).url
          : response.data.repository,
      ),
      license:
        typeof response.data.license === "string"
          ? response.data.license
          : undefined,
      description:
        typeof response.data.description === "string"
          ? response.data.description
          : undefined,
      keywords: Array.isArray(response.data.keywords)
        ? response.data.keywords.filter(
            (value): value is string => typeof value === "string",
          )
        : undefined,
      evidenceIds: [
        ...new Set([...summary.evidenceIds, evidenceId(this.sourceId, url)]),
      ],
    };
  }

  detectFrameworks(): [] {
    return [];
  }
}

export class PackagistAdapter implements RegistryAdapter {
  readonly sourceId = "packagist";
  readonly ecosystem = "php";

  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
    private readonly seeds = ["symfony", "laravel", "doctrine"],
  ) {}

  async fetchTopPackages(
    limit: number,
    options: DiscoveryOptions,
  ): Promise<PackageDetails[]> {
    const seed = options.seed ?? this.seeds[0];
    const url = `${joinUrl(this.baseUrl, "/search.json")}?q=${encodeURIComponent(seed ?? "")}&page=1`;
    const response = await this.http.requestJson<{
      results?: Array<Record<string, unknown>>;
    }>({
      sourceId: this.sourceId,
      requestClass: "search",
      url,
    });
    return (response.data.results ?? [])
      .slice(0, limit)
      .flatMap((pkg, index) => {
        if (typeof pkg.name !== "string") return [];
        const [namespace, ...nameParts] = pkg.name.split("/");
        const name = nameParts.join("/");
        if (!namespace || !name) return [];
        return [
          packageDetails(
            this.sourceId,
            this.ecosystem,
            pkg.name,
            { type: "composer", namespace, name, version: "managed" },
            {
              sourceId: this.sourceId,
              basis: "seed-ranked",
              position: index + 1,
              seed,
            },
            url,
            {
              description:
                typeof pkg.description === "string"
                  ? pkg.description
                  : undefined,
              repositoryUrl: urlOrUndefined(pkg.repository),
            },
          ),
        ];
      });
  }

  async fetchPackageDetails(summary: PackageDetails): Promise<PackageDetails> {
    const url = joinUrl(this.baseUrl, `/p2/${summary.packageName}.json`);
    const response = await this.http.requestJson<{
      packages?: Record<string, Array<Record<string, unknown>>>;
    }>({
      sourceId: this.sourceId,
      requestClass: "detail",
      url,
    });
    const versions = response.data.packages?.[summary.packageName] ?? [];
    const latest = versions[0];
    return {
      ...summary,
      releaseVersion:
        typeof latest?.version === "string"
          ? latest.version
          : summary.releaseVersion,
      homepageUrl: urlOrUndefined(latest?.homepage),
      repositoryUrl: urlOrUndefined(latest?.source),
      license:
        Array.isArray(latest?.license) && typeof latest.license[0] === "string"
          ? latest.license[0]
          : undefined,
      evidenceIds: [
        ...new Set([...summary.evidenceIds, evidenceId(this.sourceId, url)]),
      ],
    };
  }

  detectFrameworks(): [] {
    return [];
  }
}

export const pypiSeeds = [
  "django",
  "fastapi",
  "flask",
  "pydantic",
  "sqlalchemy",
  "pytest",
  "ruff",
  "uvicorn",
  "httpx",
  "poetry",
];

export class PyPIAdapter implements RegistryAdapter {
  readonly sourceId = "pypi";
  readonly ecosystem = "python";

  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
    private readonly seeds = pypiSeeds,
  ) {}

  async fetchTopPackages(
    limit: number,
    options: DiscoveryOptions,
  ): Promise<PackageDetails[]> {
    const selected = (options.seed ? [options.seed] : this.seeds).slice(
      0,
      limit,
    );
    const results: PackageDetails[] = [];
    for (const [index, seed] of selected.entries()) {
      const url = joinUrl(this.baseUrl, `/simple/${encodeURIComponent(seed)}/`);
      await this.http.requestText({
        sourceId: this.sourceId,
        requestClass: "simple",
        url,
      });
      results.push(
        packageDetails(
          this.sourceId,
          this.ecosystem,
          seed,
          { type: "pypi", name: seed.toLowerCase(), version: "managed" },
          {
            sourceId: this.sourceId,
            basis: "seed-ranked",
            position: index + 1,
            seed,
          },
          url,
        ),
      );
    }
    return results;
  }

  async fetchPackageDetails(summary: PackageDetails): Promise<PackageDetails> {
    const url = joinUrl(
      this.baseUrl,
      `/pypi/${encodeURIComponent(summary.packageName)}/json`,
    );
    const response = await this.http.requestJson<{
      info?: Record<string, unknown>;
    }>({
      sourceId: this.sourceId,
      requestClass: "detail",
      url,
    });
    const info = response.data.info ?? {};
    return {
      ...summary,
      releaseVersion:
        typeof info.version === "string"
          ? info.version
          : summary.releaseVersion,
      homepageUrl: urlOrUndefined(info.home_page),
      repositoryUrl: urlOrUndefined(info.project_url),
      license: typeof info.license === "string" ? info.license : undefined,
      description: typeof info.summary === "string" ? info.summary : undefined,
      keywords:
        typeof info.keywords === "string"
          ? info.keywords
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : undefined,
      evidenceIds: [
        ...new Set([...summary.evidenceIds, evidenceId(this.sourceId, url)]),
      ],
    };
  }

  detectFrameworks(): [] {
    return [];
  }
}

export class CratesAdapter implements RegistryAdapter {
  readonly sourceId = "crates";
  readonly ecosystem = "rust";

  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
  ) {}

  async fetchTopPackages(
    limit: number,
    options: DiscoveryOptions,
  ): Promise<PackageDetails[]> {
    const url = `${joinUrl(this.baseUrl, "/api/v1/crates")}?sort=downloads&per_page=${limit}&page=1`;
    const response = await this.http.requestJson<{
      crates?: Array<Record<string, unknown>>;
    }>({
      sourceId: this.sourceId,
      requestClass: "search",
      url,
    });
    return (response.data.crates ?? [])
      .slice(0, limit)
      .flatMap((crate, index) => {
        if (typeof crate.name !== "string") return [];
        const crateUrl = joinUrl(
          this.baseUrl,
          `/api/v1/crates/${encodeURIComponent(crate.name)}`,
        );
        const downloads: CandidateDownloadObservation[] =
          typeof crate.recent_downloads === "number"
            ? [
                {
                  sourceId: this.sourceId,
                  value: crate.recent_downloads,
                  period: "recent",
                  sampledAt: new Date().toISOString(),
                  evidenceIds: [evidenceId(this.sourceId, url)],
                },
              ]
            : [];
        return [
          packageDetails(
            this.sourceId,
            this.ecosystem,
            crate.name,
            { type: "cargo", name: crate.name, version: "managed" },
            { sourceId: this.sourceId, basis: "global", position: index + 1 },
            url,
            {
              releaseVersion:
                typeof crate.max_version === "string"
                  ? crate.max_version
                  : undefined,
              homepageUrl: urlOrUndefined(crate.homepage),
              repositoryUrl: urlOrUndefined(crate.repository),
              license:
                typeof crate.license === "string" ? crate.license : undefined,
              description:
                typeof crate.description === "string"
                  ? crate.description
                  : undefined,
              keywords: Array.isArray(crate.keywords)
                ? crate.keywords.filter(
                    (value): value is string => typeof value === "string",
                  )
                : undefined,
              downloads,
            },
          ),
        ];
      });
  }

  async fetchPackageDetails(summary: PackageDetails): Promise<PackageDetails> {
    const url = joinUrl(
      this.baseUrl,
      `/api/v1/crates/${encodeURIComponent(summary.packageName)}`,
    );
    const response = await this.http.requestJson<{
      crate?: Record<string, unknown>;
    }>({ sourceId: this.sourceId, requestClass: "detail", url });
    const crate = response.data.crate ?? {};
    return {
      ...summary,
      releaseVersion:
        typeof crate.max_version === "string"
          ? crate.max_version
          : summary.releaseVersion,
      homepageUrl: urlOrUndefined(crate.homepage),
      repositoryUrl: urlOrUndefined(crate.repository),
      license: typeof crate.license === "string" ? crate.license : undefined,
      evidenceIds: [
        ...new Set([...summary.evidenceIds, evidenceId(this.sourceId, url)]),
      ],
    };
  }

  detectFrameworks(): [] {
    return [];
  }
}

function goModuleParts(modulePath: string): {
  namespace?: string;
  name: string;
} {
  const parts = modulePath.split("/");
  if (parts.length <= 2) return { name: modulePath };
  return {
    namespace: parts.slice(0, 2).join("/"),
    name: parts.slice(2).join("/"),
  };
}

function escapeGoPath(value: string): string {
  return value
    .replace(/!/g, "!!")
    .replace(/[A-Z]/g, (char) => `!${char.toLowerCase()}`);
}

export class GoAdapter implements RegistryAdapter {
  readonly sourceId = "go";
  readonly ecosystem = "go";

  constructor(
    private readonly http: HttpClient,
    private readonly proxyUrl: string,
    private readonly pkgGoDevUrl: string,
    private readonly seeds = [
      "github.com/gin-gonic/gin",
      "github.com/labstack/echo/v4",
      "github.com/gofiber/fiber/v2",
    ],
  ) {}

  async fetchTopPackages(
    limit: number,
    options: DiscoveryOptions,
  ): Promise<PackageDetails[]> {
    const selected = (options.seed ? [options.seed] : this.seeds).slice(
      0,
      limit,
    );
    const results: PackageDetails[] = [];
    for (const [index, modulePath] of selected.entries()) {
      const url = joinUrl(
        this.proxyUrl,
        `/${escapeGoPath(modulePath)}/@v/list`,
      );
      const response = await this.http.requestText({
        sourceId: this.sourceId,
        requestClass: "module-list",
        url,
      });
      const versions = response.data
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean);
      const parts = goModuleParts(modulePath);
      results.push(
        packageDetails(
          this.sourceId,
          this.ecosystem,
          modulePath,
          {
            type: "golang",
            namespace: parts.namespace,
            name: parts.name,
            version: "managed",
          },
          {
            sourceId: this.sourceId,
            basis: "seed-ranked",
            position: index + 1,
            seed: modulePath,
          },
          url,
          { releaseVersion: versions.at(-1) },
        ),
      );
    }
    return results;
  }

  async fetchPackageDetails(summary: PackageDetails): Promise<PackageDetails> {
    const modulePath = summary.purl.namespace
      ? `${summary.purl.namespace}/${summary.purl.name}`
      : summary.purl.name;
    const url = joinUrl(this.pkgGoDevUrl, `/${modulePath}`);
    await this.http.requestText({
      sourceId: this.sourceId,
      requestClass: "module-metadata",
      url,
    });
    return {
      ...summary,
      repositoryUrl: modulePath.startsWith("github.com/")
        ? `https://${modulePath}`
        : undefined,
      evidenceIds: [
        ...new Set([...summary.evidenceIds, evidenceId(this.sourceId, url)]),
      ],
    };
  }

  detectFrameworks(): [] {
    return [];
  }
}
