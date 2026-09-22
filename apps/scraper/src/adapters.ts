import type {
  CandidateDetection,
  CandidateObservation,
  CandidateRank,
  PackageCandidate,
  Purl,
} from "@sibylhub/schemas";
import {
  candidateIdentity,
  normalizeCandidatePurl,
} from "@sibylhub/schemas/candidates";

export type DiscoveryOptions = {
  limit: number;
  seed?: string;
  signal?: AbortSignal;
};

export type PackageDetails = {
  sourceId: string;
  ecosystem: string;
  packageName: string;
  namespace?: string;
  purl: Purl;
  releaseVersion?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  license?: string;
  description?: string;
  keywords?: string[];
  downloads?: PackageCandidate["downloads"];
  stars?: PackageCandidate["stars"];
  evidenceIds: string[];
  rank: CandidateRank;
  detections?: CandidateDetection[];
  choiceAssessment?: PackageCandidate["choiceAssessment"];
  observations?: CandidateObservation[];
  dependencies?: string[];
  sourceUrl?: string;
  resolution?: PackageCandidate["resolution"];
};

export interface RegistryAdapter {
  sourceId: string;
  ecosystem: string;
  fetchTopPackages(
    limit: number,
    options: DiscoveryOptions,
  ): Promise<PackageDetails[]>;
  fetchPackageDetails(summary: PackageDetails): Promise<PackageDetails>;
  detectFrameworks(
    details: PackageDetails,
  ): CandidateDetection[] | Promise<CandidateDetection[]>;
}

export type UnsupportedSource = { sourceId: string; reason: string };
export type AdapterRunFailure = {
  packageName: string;
  sourceId: string;
  message: string;
};
export type AdapterRunResult = {
  sourceId: string;
  ecosystem: string;
  rankBasis: CandidateRank["basis"];
  discovered: number;
  candidates: PackageCandidate[];
  failures: AdapterRunFailure[];
};

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return new URL(value).toString();
}

export function normalizePackageCandidate(
  details: PackageDetails,
): PackageCandidate {
  const purl = normalizeCandidatePurl(details.purl);
  return {
    candidateId: candidateIdentity(purl),
    ecosystem: details.ecosystem,
    purl,
    name: details.packageName,
    namespace: details.namespace ?? purl.namespace,
    releaseVersion: details.releaseVersion,
    homepageUrl: normalizeUrl(details.homepageUrl),
    repositoryUrl: normalizeUrl(details.repositoryUrl),
    license: details.license,
    description: details.description,
    keywords: details.keywords,
    downloads: details.downloads,
    stars: details.stars,
    evidenceIds: [...new Set(details.evidenceIds)],
    rank: details.rank,
    detections: details.detections ?? [],
    choiceAssessment: details.choiceAssessment,
    observations: details.observations,
    resolution: details.resolution ?? { status: "unresolved" },
  };
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, RegistryAdapter>();

  constructor(adapters: RegistryAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: RegistryAdapter): void {
    if (this.adapters.has(adapter.sourceId))
      throw new Error(`Adapter ${adapter.sourceId} is already registered`);
    this.adapters.set(adapter.sourceId, adapter);
  }

  get(sourceId: string): RegistryAdapter | undefined {
    return this.adapters.get(sourceId);
  }

  list(): RegistryAdapter[] {
    return [...this.adapters.values()].sort((a, b) =>
      a.sourceId.localeCompare(b.sourceId),
    );
  }

  resolve(sourceIds: string[]): {
    supported: RegistryAdapter[];
    unsupported: UnsupportedSource[];
  } {
    const supported: RegistryAdapter[] = [];
    const unsupported: UnsupportedSource[] = [];
    for (const sourceId of sourceIds) {
      const adapter = this.get(sourceId);
      if (adapter) supported.push(adapter);
      else unsupported.push({ sourceId, reason: "No adapter is registered" });
    }
    return { supported, unsupported };
  }
}

export async function runAdapter(
  adapter: RegistryAdapter,
  options: DiscoveryOptions,
): Promise<AdapterRunResult> {
  const summaries = await adapter.fetchTopPackages(options.limit, options);
  const candidates: PackageCandidate[] = [];
  const failures: AdapterRunFailure[] = [];
  for (const summary of summaries.slice(0, options.limit)) {
    try {
      const details = await adapter.fetchPackageDetails(summary);
      const detections = await adapter.detectFrameworks(details);
      const classifierDetections = (
        await import("./classifier.js")
      ).classifyPackageDetails(details);
      const allDetections = [...detections, ...classifierDetections].filter(
        (detection, index, values) =>
          values.findIndex(
            (item) =>
              item.kind === detection.kind && item.name === detection.name,
          ) === index,
      );
      candidates.push(
        normalizePackageCandidate({ ...details, detections: allDetections }),
      );
    } catch (error) {
      failures.push({
        packageName: summary.packageName,
        sourceId: adapter.sourceId,
        message:
          error instanceof Error ? error.message : "Unknown adapter error",
      });
    }
  }
  return {
    sourceId: adapter.sourceId,
    ecosystem: adapter.ecosystem,
    rankBasis: summaries[0]?.rank.basis ?? "source-ranked",
    discovered: summaries.length,
    candidates,
    failures,
  };
}
