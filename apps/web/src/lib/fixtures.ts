import { validateMemories, type MemoriesDocument } from "@sibylhub/schemas";
import {
  allocateContextBudget,
  quotaStateFromUsage,
  usagePercentage,
} from "@sibylhub/api-client";
import type {
  ContextPartitionName,
  MemoryQueryMatch,
  ProjectContextResponse,
} from "@sibylhub/api-client";

const localProjectId = "local-project";
const localRevision = "local-fixture-2026-09-15";
const localCeiling = 128_000;
const localAllocation = allocateContextBudget(localCeiling);
const localUsage: Record<ContextPartitionName, number> = {
  rules: 7_000,
  memories: 12_000,
  ast: 27_000,
  active: 22_000,
  tools: 9_000,
};
const localUsed = Object.values(localUsage).reduce(
  (total, value) => total + value,
  0,
);

export const localMemoriesDocument: MemoriesDocument = {
  schemaVersion: "1.0",
  memories: [
    {
      title: "Server-first web rendering",
      content:
        "Astro owns the shell and React is reserved for focused browser interaction.",
      category: "architecture",
    },
  ],
};

export const localMemoryValidation = validateMemories(localMemoriesDocument);

export const localMemoryMetadata: MemoryQueryMatch[] = [
  {
    id: "local-memory-server-first",
    title: "Server-first web rendering",
    category: "architecture",
    preview:
      "Astro owns the shell and React is reserved for focused browser interaction.",
    similarityScore: 0.94,
    accessCount: 0,
  },
];

export const localFixtureSources = {
  unavailable: {
    status: "unavailable" as const,
    errorCode: "MEMORY_SEARCH_UNAVAILABLE" as const,
  },
  empty: {
    status: "no_matches" as const,
    matches: [] as MemoryQueryMatch[],
  },
};

const partitions = Object.fromEntries(
  (Object.keys(localUsage) as ContextPartitionName[]).map((name) => [
    name,
    {
      allocatedTokens: localAllocation[name],
      percentage: (localUsage[name] / localCeiling) * 100,
      usedTokens: localUsage[name],
    },
  ]),
) as ProjectContextResponse["budget"]["partitions"];

export const localProjectContext: ProjectContextResponse = {
  schemaVersion: "1.0",
  source: "local",
  status: "degraded",
  project: { id: localProjectId, name: "SibylHub local workspace" },
  sourceRevision: localRevision,
  budget: {
    ceilingTokens: localCeiling,
    usedTokens: localUsed,
    usagePercent: usagePercentage(localUsed, localCeiling),
    quotaState: quotaStateFromUsage(localUsed, localCeiling),
    rtkSavings: "-74.2%",
    rtkSavingsIsDefault: true,
    partitions,
  },
  dependencies: [
    {
      id: "local-dependency-design-system",
      packageName: "@sibylhub/design-system",
      version: "0.1.0",
      runtime: "react",
      packageManager: "pnpm",
      evidence: ["workspace manifest", "local package metadata"],
      snapshotRevision: localRevision,
      policy: "compliant",
    },
    {
      id: "local-dependency-api-client",
      packageName: "@sibylhub/api-client",
      version: "0.1.0",
      runtime: "typescript",
      packageManager: "pnpm",
      evidence: ["workspace manifest"],
      snapshotRevision: localRevision,
      policy: "unconfigured",
    },
  ],
};

export function getLocalProjectContext(): ProjectContextResponse {
  return structuredClone(localProjectContext);
}
