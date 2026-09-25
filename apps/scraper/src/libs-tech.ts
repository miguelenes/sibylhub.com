import { load } from "cheerio";
import type { CandidateObservation } from "@sibylhub/schemas";
import type {
  DiscoveryOptions,
  PackageDetails,
  RegistryAdapter,
} from "./adapters.js";
import { normalizePackageCandidate } from "./adapters.js";
import { HttpClient } from "./http.js";

type CuratedKind = CandidateObservation["kind"];
const curatedFields: CuratedKind[] = [
  "category",
  "alternative",
  "comparison",
  "pro",
  "con",
  "opinion",
  "repository",
  "license",
  "stars",
];

function slugFromUrl(value: string): string {
  const last =
    new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? "library";
  return last.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

function evidenceId(url: string): string {
  return `evidence-libs-tech-${encodeURIComponent(url).slice(0, 180)}`;
}

function extractObservations(
  html: string,
  sourceUrl: string,
): CandidateObservation[] {
  const $ = load(html);
  const sourceEvidenceId = evidenceId(sourceUrl);
  const observations: CandidateObservation[] = [];
  for (const kind of curatedFields) {
    $(`[data-field="${kind}"]`).each((_, element) => {
      const value = $(element).attr("href") ?? $(element).text().trim();
      if (!value) return;
      observations.push({
        kind,
        value,
        sourceId: "libs-tech",
        evidenceIds: [sourceEvidenceId],
      });
    });
  }
  return observations;
}

export class LibsTechAdapter implements RegistryAdapter {
  readonly sourceId = "libs-tech";
  readonly ecosystem = "curated";

  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
    private readonly seedUrls = ["https://libs.tech/categories/javascript"],
  ) {}

  async fetchTopPackages(
    limit: number,
    _options: DiscoveryOptions,
  ): Promise<PackageDetails[]> {
    const results: PackageDetails[] = [];
    for (const [index, sourceUrl] of this.seedUrls.slice(0, limit).entries()) {
      const response = await this.http.requestText({
        sourceId: this.sourceId,
        requestClass: "curated-index",
        url: sourceUrl.startsWith("http")
          ? sourceUrl
          : `${this.baseUrl}/${sourceUrl}`,
      });
      const packageName = slugFromUrl(sourceUrl);
      results.push({
        sourceId: this.sourceId,
        ecosystem: this.ecosystem,
        packageName,
        purl: { type: "generic", name: packageName, version: "managed" },
        evidenceIds: [evidenceId(sourceUrl)],
        rank: {
          sourceId: this.sourceId,
          basis: "curated",
          position: index + 1,
        },
        sourceUrl,
      });
      if (!response.data) break;
    }
    return results;
  }

  async fetchPackageDetails(summary: PackageDetails): Promise<PackageDetails> {
    const sourceUrl =
      summary.sourceUrl ?? `${this.baseUrl}/${summary.packageName}`;
    const response = await this.http.requestText({
      sourceId: this.sourceId,
      requestClass: "curated-detail",
      url: sourceUrl,
    });
    return {
      ...summary,
      sourceUrl,
      description: load(response.data)("h1").first().text().trim() || undefined,
      observations: extractObservations(response.data, sourceUrl),
      evidenceIds: [
        ...new Set([...summary.evidenceIds, evidenceId(sourceUrl)]),
      ],
    };
  }

  normalizeCuratedCandidate(details: PackageDetails) {
    return normalizePackageCandidate(details);
  }

  detectFrameworks(): [] {
    return [];
  }
}
