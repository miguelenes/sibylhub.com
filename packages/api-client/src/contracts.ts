import {
  validateSkills,
  type Purl,
  type SkillsDocument,
  type ValidationIssue,
} from "@sibylhub/schemas";

export const API_SCHEMA_VERSION = "1.0" as const;
export type ApiSchemaVersion = typeof API_SCHEMA_VERSION;

export const contextPartitionNames = [
  "rules",
  "memories",
  "ast",
  "active",
  "tools",
] as const;
export type ContextPartitionName = (typeof contextPartitionNames)[number];

export type QuotaState = "nominal" | "warning" | "critical" | "overflow";
export type SnapshotSource = "local" | "d1";
export type SnapshotStatus = "ready" | "degraded" | "stale";

export type DependencyPolicyState =
  "compliant" | "warning" | "violation" | "unconfigured" | "unavailable";

export interface ProjectIdentity {
  id: string;
  name: string;
}

export interface ContextPartition {
  allocatedTokens: number;
  percentage: number;
  usedTokens: number;
}

export type ContextPartitions = Record<ContextPartitionName, ContextPartition>;

export interface DependencyInvariant {
  name: string;
  severity: string;
  reason: string;
  approvedReplacement?: string;
}

export interface DependencyAuditRecord {
  id: string;
  packageName: string;
  version: string;
  purl?: Purl;
  runtime?: string;
  packageManager?: string;
  evidence: string[];
  snapshotRevision: string;
  policy: DependencyPolicyState;
  invariant?: DependencyInvariant;
}

export interface ProjectContextResponse {
  schemaVersion: ApiSchemaVersion;
  source: SnapshotSource;
  status: SnapshotStatus;
  project: ProjectIdentity;
  sourceRevision: string;
  budget: {
    ceilingTokens: number;
    usedTokens: number;
    usagePercent: number;
    quotaState: QuotaState;
    rtkSavings: string;
    rtkSavingsIsDefault: boolean;
    partitions: ContextPartitions;
  };
  dependencies: DependencyAuditRecord[];
}

export interface MemoryQueryRequest {
  query: string;
  projectId?: string;
  limit?: number;
}

export interface MemoryQueryMatch {
  id: string;
  title: string;
  category: string;
  preview: string;
  similarityScore: number;
  accessCount: number;
}

export interface MemoryQueryResponse {
  schemaVersion: ApiSchemaVersion;
  status: "matches" | "no_matches";
  query: {
    normalized: string;
    wasTrimmed: boolean;
  };
  matches: MemoryQueryMatch[];
}

export interface SkillCatalogEntry {
  id: string;
  scope: string;
  declarative: boolean;
  audited: boolean;
  description?: string;
}

export interface SkillCatalog {
  schemaVersion: ApiSchemaVersion;
  sourceRevision: string;
  entries: SkillCatalogEntry[];
}

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "PROJECT_CONTEXT_NOT_FOUND"
  | "PROJECT_CONTEXT_UNAVAILABLE"
  | "MEMORY_SEARCH_UNAVAILABLE"
  | "UPSTREAM_UNAVAILABLE";

export interface ApiErrorEnvelope {
  schemaVersion: ApiSchemaVersion;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface ApiValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ApiValidationResult<T> =
  | { valid: true; data: T; issues: [] }
  | { valid: false; issues: ApiValidationIssue[] };

const allowedMemoryFields = new Set(["query", "projectId", "limit"]);
const projectIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const unsafeContentPatterns = [
  {
    code: "secret_value",
    pattern: /\b(password|token|secret|authorization)\s*[:=]/i,
  },
  {
    code: "private_key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  },
  {
    code: "executable_directive",
    pattern: /(^|\s)(command|exec|script|shell)\s*[:=]/i,
  },
] as const;

function failure(issues: ApiValidationIssue[]): ApiValidationResult<never> {
  return { valid: false, issues };
}

function unsafeIssue(value: string): ApiValidationIssue | undefined {
  const match = unsafeContentPatterns.find(({ pattern }) =>
    pattern.test(value),
  );
  return match
    ? {
        path: "query",
        code: match.code,
        message: "Unsafe content is not accepted in memory queries",
      }
    : undefined;
}

export function isSafeProjectId(value: string): boolean {
  return projectIdPattern.test(value);
}

export function validateMemoryQueryRequest(
  input: unknown,
): ApiValidationResult<
  Required<Pick<MemoryQueryRequest, "query" | "limit">> &
    Pick<MemoryQueryRequest, "projectId">
> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return failure([
      {
        path: "$",
        code: "invalid_type",
        message: "Memory query must be a JSON object",
      },
    ]);
  }

  const record = input as Record<string, unknown>;
  const issues: ApiValidationIssue[] = [];
  for (const key of Object.keys(record)) {
    if (!allowedMemoryFields.has(key))
      issues.push({
        path: key,
        code: "unrecognized_key",
        message: "Unknown memory query field",
      });
  }

  const query = typeof record.query === "string" ? record.query.trim() : "";
  if (!query) {
    issues.push({
      path: "query",
      code: "required",
      message: "Query must be non-empty",
    });
  } else if (query.length > 256) {
    issues.push({
      path: "query",
      code: "max_length",
      message: "Query must be at most 256 characters",
    });
  }
  const unsafe = unsafeIssue(query);
  if (unsafe) issues.push(unsafe);

  const limit = record.limit === undefined ? 5 : record.limit;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10
  ) {
    issues.push({
      path: "limit",
      code: "invalid_limit",
      message: "Limit must be an integer between 1 and 10",
    });
  }

  const projectId = record.projectId;
  if (
    projectId !== undefined &&
    (typeof projectId !== "string" || !isSafeProjectId(projectId))
  ) {
    issues.push({
      path: "projectId",
      code: "invalid_project_id",
      message: "Project identifier has an invalid format",
    });
  }

  if (issues.length) return failure(issues);
  return {
    valid: true,
    data: {
      query,
      limit: limit as number,
      projectId: projectId as string | undefined,
    },
    issues: [],
  };
}

export function validateSkillCatalog(
  input: unknown,
): ApiValidationResult<SkillCatalog> {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return failure([
      {
        path: "$",
        code: "invalid_type",
        message: "Skill catalog must be a JSON object",
      },
    ]);

  const record = input as Record<string, unknown>;
  const issues: ApiValidationIssue[] = [];
  if (record.schemaVersion !== API_SCHEMA_VERSION)
    issues.push({
      path: "schemaVersion",
      code: "unsupported_version",
      message: "Skill catalog schema version is unsupported",
    });
  if (typeof record.sourceRevision !== "string" || !record.sourceRevision)
    issues.push({
      path: "sourceRevision",
      code: "required",
      message: "Skill catalog source revision is required",
    });
  if (!Array.isArray(record.entries))
    issues.push({
      path: "entries",
      code: "invalid_type",
      message: "Skill catalog entries must be an array",
    });

  const entries: SkillCatalogEntry[] = [];
  if (Array.isArray(record.entries)) {
    const identifiers = new Set<string>();
    record.entries.forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        issues.push({
          path: `entries.${index}`,
          code: "invalid_type",
          message: "Skill catalog entry must be an object",
        });
        return;
      }
      const value = entry as Record<string, unknown>;
      const id = value.id;
      const scope = value.scope;
      const declarative = value.declarative;
      const audited = value.audited;
      if (typeof id !== "string" || !id) {
        issues.push({
          path: `entries.${index}.id`,
          code: "required",
          message: "Skill identifier is required",
        });
        return;
      }
      if (identifiers.has(id)) {
        issues.push({
          path: `entries.${index}.id`,
          code: "duplicate_identifier",
          message: "Skill identifiers must be unique",
        });
        return;
      }
      identifiers.add(id);
      if (typeof scope !== "string" || !scope)
        issues.push({
          path: `entries.${index}.scope`,
          code: "required",
          message: "Skill scope is required",
        });
      if (typeof declarative !== "boolean")
        issues.push({
          path: `entries.${index}.declarative`,
          code: "invalid_type",
          message: "Skill declarative state must be boolean",
        });
      if (typeof audited !== "boolean")
        issues.push({
          path: `entries.${index}.audited`,
          code: "invalid_type",
          message: "Skill audit state must be boolean",
        });
      if (
        value.description !== undefined &&
        typeof value.description !== "string"
      )
        issues.push({
          path: `entries.${index}.description`,
          code: "invalid_type",
          message: "Skill description must be a string",
        });
      entries.push({
        id,
        scope: typeof scope === "string" ? scope : "",
        declarative: declarative === true,
        audited: audited === true,
        ...(typeof value.description === "string"
          ? { description: value.description }
          : {}),
      });
    });
  }

  if (issues.length) return failure(issues);
  return {
    valid: true,
    data: {
      schemaVersion: API_SCHEMA_VERSION,
      sourceRevision: record.sourceRevision as string,
      entries,
    },
    issues: [],
  };
}

export function createSkillsDocument(
  catalog: SkillCatalog,
  enabledIds: readonly string[],
): ApiValidationResult<SkillsDocument> {
  const enabled = new Set(enabledIds);
  const unknown = enabledIds.filter(
    (id) => !catalog.entries.some((entry) => entry.id === id),
  );
  if (unknown.length)
    return failure([
      {
        path: "skills",
        code: "unknown_skill",
        message: "The draft contains an unknown catalog skill",
      },
    ]);

  const blocked = catalog.entries.filter(
    (entry) => enabled.has(entry.id) && (!entry.audited || !entry.declarative),
  );
  if (blocked.length)
    return failure([
      {
        path: "skills",
        code: "ineligible_skill",
        message: "Only audited declarative skills can be enabled",
      },
    ]);

  const document: SkillsDocument = {
    schemaVersion: "1.0",
    skills: catalog.entries
      .filter((entry) => enabled.has(entry.id))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, scope }) => ({ id, scope, declarative: true })),
  };
  const result = validateSkills(document);
  if (!result.valid) {
    return failure(
      result.issues.map((issue: ValidationIssue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
    );
  }
  return { valid: true, data: result.data, issues: [] };
}

export function safeError(
  code: ApiErrorCode,
  message: string,
): ApiErrorEnvelope {
  return {
    schemaVersion: API_SCHEMA_VERSION,
    error: { code, message },
  };
}
