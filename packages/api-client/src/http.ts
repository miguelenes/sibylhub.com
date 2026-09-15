import {
  isSafeProjectId,
  safeError,
  validateMemoryQueryRequest,
  type ApiErrorCode,
  type ApiErrorEnvelope,
  type MemoryQueryRequest,
  type MemoryQueryResponse,
  type ProjectContextResponse,
} from "./contracts.js";

export interface RustInvariantRequest {
  ecosystem: string;
  runtime: string;
  dependencies: Record<string, string>;
}

export interface RustInvariantResponse {
  compliant: boolean;
  violations: unknown[];
}

export interface RustContextBudgetRequest {
  context_ceiling_tokens: number;
}

export interface RustContextBudgetResponse {
  context_ceiling_tokens: number;
  rules: number;
  memories: number;
  ast_skeletons: number;
  active_files: number;
  tools: number;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorEnvelope };

export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

function safeBaseUrl(baseUrl: string): URL {
  const parsed = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  )
    throw new TypeError(
      "API base URL must be an http(s) URL without credentials",
    );
  return parsed;
}

function endpoint(path: string, baseUrl?: string): string {
  if (!baseUrl) return path;
  const base = safeBaseUrl(baseUrl);
  return new URL(path, base).toString();
}

function errorCodeForStatus(
  status: number,
  fallback: ApiErrorCode,
): ApiErrorCode {
  if (status === 404) return "PROJECT_CONTEXT_NOT_FOUND";
  if (status === 400) return "INVALID_REQUEST";
  return fallback;
}

function safeErrorFromResponse(
  status: number,
  body: unknown,
  fallback: ApiErrorCode,
): ApiErrorEnvelope {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "object" &&
    (body as { error?: { code?: unknown; message?: unknown } }).error !== null
  ) {
    const error = (body as { error: { code?: unknown; message?: unknown } })
      .error;
    const allowedCodes = new Set<ApiErrorCode>([
      "INVALID_REQUEST",
      "PROJECT_CONTEXT_NOT_FOUND",
      "PROJECT_CONTEXT_UNAVAILABLE",
      "MEMORY_SEARCH_UNAVAILABLE",
      "UPSTREAM_UNAVAILABLE",
    ]);
    if (
      typeof error.code === "string" &&
      allowedCodes.has(error.code as ApiErrorCode)
    )
      return safeError(
        error.code as ApiErrorCode,
        typeof error.message === "string"
          ? error.message
          : "The request could not be completed",
      );
  }
  return safeError(
    errorCodeForStatus(status, fallback),
    status >= 500
      ? "The requested service is unavailable"
      : "The request could not be completed",
  );
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallback: ApiErrorCode,
  baseUrl: string | undefined,
  fetcher: Fetcher,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetcher(endpoint(path, baseUrl), {
      ...init,
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    return {
      ok: false,
      status: 503,
      error: safeError(fallback, "The requested service is unavailable"),
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (!response.ok)
    return {
      ok: false,
      status: response.status,
      error: safeErrorFromResponse(response.status, body, fallback),
    };
  if (body === undefined)
    return {
      ok: false,
      status: 502,
      error: safeError(
        "UPSTREAM_UNAVAILABLE",
        "The service returned an invalid response",
      ),
    };
  return { ok: true, status: response.status, data: body as T };
}

export function getProjectContext(
  options: {
    projectId?: string;
    baseUrl?: string;
    fetcher?: Fetcher;
  } = {},
): Promise<ApiResult<ProjectContextResponse>> {
  if (options.projectId && !isSafeProjectId(options.projectId))
    return Promise.resolve({
      ok: false,
      status: 400,
      error: safeError(
        "INVALID_REQUEST",
        "Project identifier has an invalid format",
      ),
    });
  const query = options.projectId
    ? `?project_id=${encodeURIComponent(options.projectId)}`
    : "";
  return requestJson<ProjectContextResponse>(
    `/api/project/context${query}`,
    { method: "GET" },
    "PROJECT_CONTEXT_UNAVAILABLE",
    options.baseUrl,
    options.fetcher ?? defaultFetcher,
  );
}

export function queryMemory(
  input: unknown,
  options: { baseUrl?: string; fetcher?: Fetcher } = {},
): Promise<ApiResult<MemoryQueryResponse>> {
  const validation = validateMemoryQueryRequest(input);
  if (!validation.valid)
    return Promise.resolve({
      ok: false,
      status: 400,
      error: safeError("INVALID_REQUEST", "Memory query validation failed"),
    });
  return requestJson<MemoryQueryResponse>(
    "/api/memory/query",
    { method: "POST", body: JSON.stringify(validation.data) },
    "MEMORY_SEARCH_UNAVAILABLE",
    options.baseUrl,
    options.fetcher ?? defaultFetcher,
  );
}

export function checkRustInvariants(
  baseUrl: string,
  input: RustInvariantRequest,
  fetcher: Fetcher = defaultFetcher,
): Promise<ApiResult<RustInvariantResponse>> {
  if (
    !input.ecosystem.trim() ||
    !input.runtime.trim() ||
    Object.keys(input.dependencies).length > 100
  )
    return Promise.resolve({
      ok: false,
      status: 400,
      error: safeError(
        "INVALID_REQUEST",
        "Invariant request validation failed",
      ),
    });
  return requestJson<RustInvariantResponse>(
    "/v1/invariants/check",
    { method: "POST", body: JSON.stringify(input) },
    "UPSTREAM_UNAVAILABLE",
    baseUrl,
    fetcher,
  );
}

export function requestRustContextBudget(
  baseUrl: string,
  input: RustContextBudgetRequest,
  fetcher: Fetcher = defaultFetcher,
): Promise<ApiResult<RustContextBudgetResponse>> {
  if (
    !Number.isSafeInteger(input.context_ceiling_tokens) ||
    input.context_ceiling_tokens <= 0
  )
    return Promise.resolve({
      ok: false,
      status: 400,
      error: safeError("INVALID_REQUEST", "Context ceiling must be positive"),
    });
  return requestJson<RustContextBudgetResponse>(
    "/v1/context/budget",
    { method: "POST", body: JSON.stringify(input) },
    "UPSTREAM_UNAVAILABLE",
    baseUrl,
    fetcher,
  );
}
