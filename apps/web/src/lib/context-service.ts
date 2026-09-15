import {
  allocateContextBudget,
  quotaStateFromUsage,
  usagePercentage,
  type DependencyAuditRecord,
  type DependencyPolicyState,
  type ProjectContextResponse,
} from "@sibylhub/api-client";
import type { Purl } from "@sibylhub/schemas";
import { getLocalProjectContext } from "./fixtures";
import type { RuntimeBindings } from "./bindings";

const DEFAULT_RTK_SAVINGS = "-74.2%";
const MAX_DEPENDENCIES = 100;
const policyStates = new Set<DependencyPolicyState>([
  "compliant",
  "warning",
  "violation",
  "unconfigured",
  "unavailable",
]);

type ContextServiceFailure = {
  ok: false;
  kind: "not_found" | "unavailable";
};

export type ContextServiceResult =
  { ok: true; data: ProjectContextResponse } | ContextServiceFailure;

type ContextSnapshotRow = {
  project_id: unknown;
  project_name: unknown;
  source_revision: unknown;
  context_ceiling_tokens: unknown;
  rules_used_tokens: unknown;
  memories_used_tokens: unknown;
  ast_used_tokens: unknown;
  active_used_tokens: unknown;
  tools_used_tokens: unknown;
  rtk_savings: unknown;
  snapshot_status: unknown;
};

type DependencyRow = {
  dependency_id: unknown;
  package_name: unknown;
  package_version: unknown;
  purl_json: unknown;
  runtime: unknown;
  package_manager: unknown;
  evidence_json: unknown;
  snapshot_revision: unknown;
  policy_state: unknown;
  invariant_name: unknown;
  invariant_severity: unknown;
  invariant_reason: unknown;
  approved_replacement: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength
    ? value
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function parsePurl(value: unknown): Purl | undefined {
  if (typeof value !== "string" || value.length > 2_048) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return undefined;
    if (
      typeof parsed.type !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.version !== "string"
    )
      return undefined;
    return {
      type: parsed.type,
      name: parsed.name,
      version: parsed.version,
      ...(typeof parsed.namespace === "string"
        ? { namespace: parsed.namespace }
        : {}),
    };
  } catch {
    return undefined;
  }
}

function parseEvidence(value: unknown): string[] {
  if (typeof value !== "string" || value.length > 8_192) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string => typeof item === "string" && item.length <= 512,
    );
  } catch {
    return [];
  }
}

function mapDependency(
  row: DependencyRow,
  sourceRevision: string,
): DependencyAuditRecord | null {
  const id = nonEmptyString(row.dependency_id, 160);
  const packageName = nonEmptyString(row.package_name, 256);
  const version = nonEmptyString(row.package_version, 128);
  const policy = row.policy_state;
  const snapshotRevision = nonEmptyString(row.snapshot_revision, 256);
  if (
    !id ||
    !packageName ||
    !version ||
    !snapshotRevision ||
    typeof policy !== "string" ||
    !policyStates.has(policy as DependencyPolicyState) ||
    snapshotRevision !== sourceRevision
  )
    return null;

  const invariantName = nonEmptyString(row.invariant_name, 256);
  const invariantSeverity = nonEmptyString(row.invariant_severity, 64);
  const invariantReason = nonEmptyString(row.invariant_reason, 1_024);
  const evidence = parseEvidence(row.evidence_json);
  if (policy === "compliant" && evidence.length === 0) return null;
  const invariant =
    invariantName && invariantSeverity && invariantReason
      ? {
          name: invariantName,
          severity: invariantSeverity,
          reason: invariantReason,
          ...(nonEmptyString(row.approved_replacement, 512)
            ? { approvedReplacement: row.approved_replacement as string }
            : {}),
        }
      : undefined;

  return {
    id,
    packageName,
    version,
    ...(parsePurl(row.purl_json) ? { purl: parsePurl(row.purl_json) } : {}),
    ...(nonEmptyString(row.runtime, 128)
      ? { runtime: row.runtime as string }
      : {}),
    ...(nonEmptyString(row.package_manager, 128)
      ? { packageManager: row.package_manager as string }
      : {}),
    evidence,
    snapshotRevision,
    policy: policy as DependencyPolicyState,
    ...(invariant ? { invariant } : {}),
  };
}

function buildContextResponse(
  row: ContextSnapshotRow,
  dependencies: DependencyAuditRecord[],
): ProjectContextResponse | null {
  const projectId = nonEmptyString(row.project_id, 64);
  const projectName = nonEmptyString(row.project_name, 256);
  const sourceRevision = nonEmptyString(row.source_revision, 256);
  const ceilingTokens = nonNegativeInteger(row.context_ceiling_tokens);
  const usage = {
    rules: nonNegativeInteger(row.rules_used_tokens),
    memories: nonNegativeInteger(row.memories_used_tokens),
    ast: nonNegativeInteger(row.ast_used_tokens),
    active: nonNegativeInteger(row.active_used_tokens),
    tools: nonNegativeInteger(row.tools_used_tokens),
  };
  if (
    !projectId ||
    !projectName ||
    !sourceRevision ||
    ceilingTokens === null ||
    ceilingTokens <= 0 ||
    Object.values(usage).some((value) => value === null)
  )
    return null;

  const safeUsage = usage as Record<keyof typeof usage, number>;
  const snapshotStatus = row.snapshot_status;
  if (
    snapshotStatus !== "ready" &&
    snapshotStatus !== "degraded" &&
    snapshotStatus !== "stale"
  )
    return null;
  const allocated = allocateContextBudget(ceilingTokens);
  const partitions = Object.fromEntries(
    Object.entries(safeUsage).map(([name, usedTokens]) => [
      name,
      {
        allocatedTokens: allocated[name as keyof typeof allocated],
        percentage: usagePercentage(usedTokens, ceilingTokens),
        usedTokens,
      },
    ]),
  ) as ProjectContextResponse["budget"]["partitions"];
  const usedTokens = Object.values(safeUsage).reduce(
    (total, value) => total + value,
    0,
  );
  const rtkSavings = nonEmptyString(row.rtk_savings, 32);

  return {
    schemaVersion: "1.0",
    source: "d1",
    status: snapshotStatus,
    project: { id: projectId, name: projectName },
    sourceRevision,
    budget: {
      ceilingTokens,
      usedTokens,
      usagePercent: usagePercentage(usedTokens, ceilingTokens),
      quotaState: quotaStateFromUsage(usedTokens, ceilingTokens),
      rtkSavings: rtkSavings ?? DEFAULT_RTK_SAVINGS,
      rtkSavingsIsDefault: rtkSavings === null,
      partitions,
    },
    dependencies,
  };
}

export async function readProjectContext(
  bindings: RuntimeBindings,
  requestedProjectId?: string,
  activeProjectId?: string,
): Promise<ContextServiceResult> {
  if (!bindings.DB) {
    if (requestedProjectId && requestedProjectId !== "local-project")
      return { ok: false, kind: "not_found" };
    return { ok: true, data: getLocalProjectContext() };
  }

  const projectId = requestedProjectId ?? activeProjectId;
  if (!projectId) return { ok: false, kind: "unavailable" };

  try {
    const snapshot = await bindings.DB.prepare(
      `SELECT project_id, project_name, source_revision, context_ceiling_tokens,
        rules_used_tokens, memories_used_tokens, ast_used_tokens,
        active_used_tokens, tools_used_tokens, rtk_savings, snapshot_status
       FROM project_context_snapshots
       WHERE project_id = ?
       ORDER BY captured_at DESC
       LIMIT 1`,
    )
      .bind(projectId)
      .first<ContextSnapshotRow>();
    if (!snapshot) return { ok: false, kind: "not_found" };

    const sourceRevision = nonEmptyString(snapshot.source_revision, 256);
    if (!sourceRevision) return { ok: false, kind: "unavailable" };
    const dependencyRows = await bindings.DB.prepare(
      `SELECT dependency_id, package_name, package_version, purl_json,
        runtime, package_manager, evidence_json, snapshot_revision,
        policy_state, invariant_name, invariant_severity, invariant_reason,
        approved_replacement
       FROM project_dependencies
       WHERE project_id = ? AND snapshot_revision = ?
       ORDER BY dependency_id ASC
       LIMIT ${MAX_DEPENDENCIES}`,
    )
      .bind(projectId, sourceRevision)
      .all<DependencyRow>();
    const mappedDependencies = dependencyRows.results.map((row) =>
      mapDependency(row, sourceRevision),
    );
    if (mappedDependencies.some((row) => row === null))
      return { ok: false, kind: "unavailable" };
    const dependencies = mappedDependencies as DependencyAuditRecord[];
    const response = buildContextResponse(snapshot, dependencies);
    return response
      ? { ok: true, data: response }
      : { ok: false, kind: "unavailable" };
  } catch {
    return { ok: false, kind: "unavailable" };
  }
}
