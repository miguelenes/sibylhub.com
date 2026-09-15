import {
  safeError,
  type ApiErrorEnvelope,
  type MemoryQueryResponse,
} from "@sibylhub/api-client";
import { env } from "cloudflare:workers";
import { readRuntimeEnv } from "../../../lib/bindings";
import { queryMemory } from "../../../lib/memory-service";

export const prerender = false;

const jsonHeaders = {
  "cache-control": "private, no-store",
  "content-type": "application/json; charset=utf-8",
};

function response(
  payload: MemoryQueryResponse | ApiErrorEnvelope,
  status = 200,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
}

export async function POST({ request }: { request: Request }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response(safeError("INVALID_REQUEST", "Invalid JSON request"), 400);
  }

  const runtimeEnv = readRuntimeEnv(env);
  const result = await queryMemory(body, runtimeEnv, {
    activeProjectId: runtimeEnv.SIBYL_ACTIVE_PROJECT_ID,
  });
  if (result.ok) return response(result.data);
  if (result.kind === "invalid_request")
    return response(safeError("INVALID_REQUEST", "Invalid memory query"), 400);
  return response(
    safeError("MEMORY_SEARCH_UNAVAILABLE", "Memory search is unavailable"),
    503,
  );
}
