import { Command } from "commander";
import type {
  CandidateArtifact,
  CandidateEvidence,
  PackageCandidate,
  CandidateSourceCoverage,
} from "@sibylhub/schemas";
import { AdapterRegistry, runAdapter } from "./adapters.js";
import {
  buildCandidateArtifact,
  hashDeterministic,
  writeCandidateArtifact,
} from "./artifact.js";
import { loadScraperConfig, type ScraperConfig } from "./config.js";
import { createDefaultRegistry } from "./registry.js";
import { SynchronizationClient, writeSynchronizationReport } from "./sync.js";

const aliases: Record<string, string> = {
  javascript: "npm",
  typescript: "npm",
  php: "packagist",
  python: "pypi",
  rust: "crates",
};
const allSources = ["npm", "packagist", "pypi", "crates", "go", "libs-tech"];

export type RunSummary = {
  status: "success" | "partial" | "failed" | "unsupported";
  exitCode: 0 | 1;
  requested: string[];
  sources: Record<
    string,
    {
      status: "success" | "partial" | "failed" | "unsupported";
      rankBasis?: string;
      discovered: number;
      normalized: number;
      failed: number;
      message?: string;
    }
  >;
  counts: {
    discovered: number;
    deduplicated: number;
    detailed: number;
    normalized: number;
    classified: number;
    failed: number;
    skipped: number;
  };
  frameworks: Record<string, number>;
  artifact?: CandidateArtifact;
};

export type ExecuteRunOptions = {
  ecosystems: string[];
  limit: number;
  concurrency: number;
  strict: boolean;
  json: boolean;
  firecrawl?: boolean;
  sync?: boolean;
  config: ScraperConfig;
  registry: AdapterRegistry;
};

export function normalizeEcosystems(input: string): string[] {
  const requested = input
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const expanded = requested.flatMap((value) =>
    value === "all" ? allSources : [aliases[value] ?? value],
  );
  return [...new Set(expanded)];
}

export async function executeRun(
  options: ExecuteRunOptions,
): Promise<RunSummary> {
  if (options.sync && !options.config.sync.enabled)
    throw new Error(
      "Synchronization requires explicit configuration and enablement",
    );
  if (options.firecrawl && !options.config.firecrawl.enabled)
    throw new Error("Firecrawl requires explicit configuration and enablement");

  const resolved = options.registry.resolve(options.ecosystems);
  const startedAt = new Date().toISOString();
  const sources: RunSummary["sources"] = {};
  const sourceCoverage: CandidateSourceCoverage[] = [];
  const normalizedCandidates: PackageCandidate[] = [];
  for (const unsupported of resolved.unsupported)
    sources[unsupported.sourceId] = {
      status: "unsupported",
      discovered: 0,
      normalized: 0,
      failed: 0,
      message: unsupported.reason,
    };
  for (const unsupported of resolved.unsupported)
    sourceCoverage.push({
      sourceId: unsupported.sourceId,
      ecosystem: "unknown",
      status: "unsupported",
      rankBasis: "curated",
      discovered: 0,
      deduplicated: 0,
      detailed: 0,
      normalized: 0,
      classified: 0,
      conflicted: 0,
      synchronized: 0,
      skipped: 0,
      failed: 0,
    });

  const results = await Promise.all(
    resolved.supported.map((adapter) =>
      runAdapter(adapter, {
        limit: options.limit,
        signal: undefined,
      }),
    ),
  );
  const counts = {
    discovered: 0,
    deduplicated: 0,
    detailed: 0,
    normalized: 0,
    classified: 0,
    failed: 0,
    skipped: 0,
  };
  const frameworks: Record<string, number> = {};
  const seenCandidateIds = new Set<string>();
  for (const result of results) {
    const sourceStatus = result.failures.length
      ? result.candidates.length
        ? "partial"
        : "failed"
      : "success";
    sources[result.sourceId] = {
      status: sourceStatus,
      rankBasis: result.rankBasis,
      discovered: result.discovered,
      normalized: result.candidates.length,
      failed: result.failures.length,
      message: result.failures[0]?.message,
    };
    counts.discovered += result.discovered;
    const uniqueCandidates = result.candidates.filter((candidate) => {
      if (seenCandidateIds.has(candidate.candidateId)) return false;
      seenCandidateIds.add(candidate.candidateId);
      return true;
    });
    counts.deduplicated += uniqueCandidates.length;
    counts.detailed += result.candidates.length;
    counts.normalized += uniqueCandidates.length;
    normalizedCandidates.push(...uniqueCandidates);
    counts.classified += uniqueCandidates.filter(
      (candidate) => candidate.detections.length > 0,
    ).length;
    counts.failed += result.failures.length;
    sourceCoverage.push({
      sourceId: result.sourceId,
      ecosystem: result.ecosystem,
      status: sourceStatus,
      rankBasis: result.rankBasis,
      sourceUrl:
        options.config.sources[
          result.sourceId as keyof typeof options.config.sources
        ],
      discovered: result.discovered,
      deduplicated: uniqueCandidates.length,
      detailed: result.candidates.length,
      normalized: uniqueCandidates.length,
      classified: uniqueCandidates.filter(
        (candidate) => candidate.detections.length > 0,
      ).length,
      conflicted: uniqueCandidates.filter(
        (candidate) => (candidate.observations?.length ?? 0) > 1,
      ).length,
      synchronized: 0,
      skipped: 0,
      failed: result.failures.length,
    });
    for (const candidate of uniqueCandidates)
      for (const detection of candidate.detections)
        if (detection.kind === "framework")
          frameworks[detection.name] = (frameworks[detection.name] ?? 0) + 1;
  }

  const hasUnsupported = resolved.unsupported.length > 0;
  const hasFailures = results.some((result) => result.failures.length > 0);
  const noArtifact = resolved.supported.length > 0 && counts.normalized === 0;
  const status = noArtifact
    ? "failed"
    : hasFailures || hasUnsupported
      ? "partial"
      : resolved.supported.length
        ? "success"
        : "unsupported";
  const exitCode =
    noArtifact || (options.strict && (hasFailures || hasUnsupported)) ? 1 : 0;
  const candidates = normalizedCandidates;
  const evidence = new Map<string, CandidateEvidence>();
  for (const candidate of candidates)
    for (const evidenceId of candidate.evidenceIds)
      evidence.set(evidenceId, {
        id: evidenceId,
        sourceId: candidate.rank.sourceId,
        sourceKind:
          candidate.rank.sourceId === "libs-tech" ? "curated" : "registry",
        sourceUrl:
          options.config.sources[
            candidate.rank.sourceId as keyof typeof options.config.sources
          ] ?? "https://localhost.invalid",
        retrievedAt: startedAt,
        contentHash: hashDeterministic(evidenceId),
        evidenceType: "adapter-observation",
      });
  const artifact = noArtifact
    ? undefined
    : buildCandidateArtifact({
        crawlId: `crawl-${startedAt.replace(/\D/g, "").slice(0, 17)}`,
        startedAt,
        completedAt: new Date().toISOString(),
        configHash: hashDeterministic({
          sources: options.config.sources,
          limits: options.config.limits,
        }),
        classifierVersions: { catalog: "catalog-1" },
        sourceCoverage,
        candidates,
        evidence: [...evidence.values()],
        diagnostics: results.flatMap((result) =>
          result.failures.map((failure) => ({
            severity: "warning" as const,
            code: "source_failure",
            message: failure.message.slice(0, 2000),
            candidateId: undefined,
            sourceId: failure.sourceId,
          })),
        ),
        telemetry: {
          ...counts,
          conflicted: sourceCoverage.reduce(
            (total, source) => total + source.conflicted,
            0,
          ),
          synchronized: 0,
          requests: [],
        },
      });
  return {
    status,
    exitCode,
    requested: options.ecosystems,
    sources,
    counts,
    frameworks: Object.fromEntries(
      Object.entries(frameworks).sort(([a], [b]) => a.localeCompare(b)),
    ),
    artifact,
  };
}

export function renderSummary(
  summary: RunSummary,
  isTTY: boolean,
): RunSummary & { progress?: string[] } {
  if (!isTTY) return summary;
  return {
    ...summary,
    progress: Object.entries(summary.sources).map(
      ([sourceId, source]) =>
        `${sourceId}: ${source.status} (${source.normalized} normalized)`,
    ),
  };
}

export function createProgram(): Command {
  const program = new Command()
    .name("sibyl-scrape")
    .description("Bounded SibylHub package discovery");
  program
    .command("run")
    .requiredOption(
      "--ecosystems <ecosystems>",
      "comma-separated ecosystem or language aliases",
    )
    .option("--limit <number>", "package limit per source", (value) =>
      Number(value),
    )
    .option("--concurrency <number>", "per-source concurrency", (value) =>
      Number(value),
    )
    .option("--firecrawl", "enable configured Firecrawl enrichment")
    .option("--sync", "enable configured Laravel synchronization")
    .option("--strict", "return non-zero for partial or unsupported sources")
    .option("--json", "emit machine-readable output")
    .action(async (options: Record<string, unknown>) => {
      const config = loadScraperConfig();
      const summary = await executeRun({
        ecosystems: normalizeEcosystems(String(options.ecosystems)),
        limit: Number(options.limit ?? config.limits.limit),
        concurrency: Number(options.concurrency ?? config.limits.concurrency),
        strict: Boolean(options.strict),
        json: Boolean(options.json),
        firecrawl: Boolean(options.firecrawl),
        sync: Boolean(options.sync),
        config,
        registry: createDefaultRegistry(config),
      });
      let artifactOutput:
        { path: string; bytes: number; contentIdentity: string } | undefined;
      if (summary.artifact) {
        const written = await writeCandidateArtifact(
          summary.artifact,
          config.artifactDir,
          config.limits.maxArtifactBytes,
        );
        artifactOutput = {
          ...written,
          contentIdentity: summary.artifact.contentIdentity,
        };
        if (options.sync) {
          const report = await new SynchronizationClient({
            url: config.sync.url!,
            token: config.sync.token!,
            maxBatchSize: config.limits.maxBatchSize,
            timeoutMs: config.limits.timeoutMs,
          }).synchronize(summary.artifact);
          await writeSynchronizationReport(report, written.path);
          artifactOutput = {
            ...artifactOutput,
            contentIdentity: summary.artifact.contentIdentity,
          };
        }
      }
      const output = renderSummary(
        summary,
        Boolean(process.stdout.isTTY) && !options.json,
      );
      delete output.artifact;
      if (artifactOutput)
        (output as unknown as { artifact?: unknown }).artifact = artifactOutput;
      process.stdout.write(`${JSON.stringify(output)}\n`);
      process.exitCode = summary.exitCode;
    });
  return program;
}

export async function main(argv = process.argv): Promise<void> {
  await createProgram().parseAsync(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
