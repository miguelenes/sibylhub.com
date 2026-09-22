import PQueue from "p-queue";

export type HttpFailureCode =
  | "timeout"
  | "network"
  | "throttled"
  | "provider"
  | "authentication"
  | "authorization"
  | "bad_request"
  | "permanent_not_found"
  | "response_too_large"
  | "invalid_json";

export class HttpError extends Error {
  constructor(
    public readonly code: HttpFailureCode,
    public readonly status?: number,
    public readonly attempts = 1,
  ) {
    super(`HTTP request failed: ${code}`);
    this.name = "HttpError";
  }
}

export type HttpRequest = {
  sourceId: string;
  requestClass: string;
  url: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
  signal?: AbortSignal;
};

export type HttpResponse = {
  sourceId: string;
  status: number;
  attempts: number;
  durationMs: number;
  data: string;
};

export type HttpClientOptions = {
  userAgent: string;
  timeoutMs: number;
  maxAttempts: number;
  maxRetryDelayMs: number;
  concurrency: number;
  maxPageBytes: number;
};

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

function failureForStatus(status: number): HttpFailureCode {
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 404) return "permanent_not_found";
  if (status === 400) return "bad_request";
  if (status === 429) return "throttled";
  return "provider";
}

function retryDelay(
  response: Response,
  attempt: number,
  maxDelay: number,
): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds))
      return Math.min(maxDelay, Math.max(0, seconds * 1000));
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date))
      return Math.min(maxDelay, Math.max(0, date - Date.now()));
  }
  const base = Math.min(maxDelay, 250 * 2 ** Math.max(0, attempt - 1));
  return Math.floor(base / 2 + Math.random() * (base / 2));
}

function sleep(ms: number): Promise<void> {
  return ms > 0
    ? new Promise((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();
}

export function redactUrl(value: string): string {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()])
    if (/token|secret|password|authorization/i.test(key))
      url.searchParams.set(key, "[REDACTED]");
  url.username = "";
  url.password = "";
  return url.toString();
}

export class HttpClient {
  private readonly queues = new Map<string, PQueue>();

  constructor(private readonly options: HttpClientOptions) {}

  private queueFor(sourceId: string): PQueue {
    const existing = this.queues.get(sourceId);
    if (existing) return existing;
    const queue = new PQueue({ concurrency: this.options.concurrency });
    this.queues.set(sourceId, queue);
    return queue;
  }

  async requestText(request: HttpRequest): Promise<HttpResponse> {
    return this.queueFor(request.sourceId).add(() => this.execute(request));
  }

  async requestJson<T>(
    request: HttpRequest,
  ): Promise<Omit<HttpResponse, "data"> & { data: T }> {
    const response = await this.requestText(request);
    try {
      return { ...response, data: JSON.parse(response.data) as T };
    } catch {
      throw new HttpError("invalid_json", response.status, response.attempts);
    }
  }

  private async execute(request: HttpRequest): Promise<HttpResponse> {
    const started = Date.now();
    let attempts = 0;
    while (attempts < this.options.maxAttempts) {
      attempts += 1;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.options.timeoutMs,
      );
      try {
        const response = await fetch(request.url, {
          method: request.method ?? "GET",
          headers: {
            accept: "application/json, text/plain;q=0.9, */*;q=0.1",
            "user-agent": this.options.userAgent,
            ...request.headers,
          },
          body: request.body,
          signal: request.signal ?? controller.signal,
        });
        if (!response.ok) {
          if (
            retryableStatuses.has(response.status) &&
            attempts < this.options.maxAttempts
          ) {
            await sleep(
              retryDelay(response, attempts, this.options.maxRetryDelayMs),
            );
            continue;
          }
          throw new HttpError(
            failureForStatus(response.status),
            response.status,
            attempts,
          );
        }
        const data = await response.text();
        if (
          new TextEncoder().encode(data).byteLength > this.options.maxPageBytes
        )
          throw new HttpError("response_too_large", response.status, attempts);
        return {
          sourceId: request.sourceId,
          status: response.status,
          attempts,
          durationMs: Date.now() - started,
          data,
        };
      } catch (error) {
        if (error instanceof HttpError) throw error;
        const code =
          error instanceof DOMException && error.name === "AbortError"
            ? "timeout"
            : "network";
        if (attempts >= this.options.maxAttempts)
          throw new HttpError(code, undefined, attempts);
        await sleep(
          Math.min(this.options.maxRetryDelayMs, 250 * 2 ** (attempts - 1)),
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new HttpError("network", undefined, attempts);
  }
}
