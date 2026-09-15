import {
  isSafeProjectId,
  safeError,
  type ApiErrorEnvelope,
  type ProjectContextResponse,
} from "@sibylhub/api-client";
import { env } from "cloudflare:workers";
import { readRuntimeEnv } from "../../../lib/bindings";
import { readProjectContext } from "../../../lib/context-service";

export const prerender = false;

const jsonHeaders = {
  "cache-control": "private, no-store",
  "content-type": "application/json; charset=utf-8",
};

function response(
  payload: ProjectContextResponse | ApiErrorEnvelope,
  status = 200,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
}

export async function GET({ url }: { url: URL }) {
  const requestedProjectId = url.searchParams.get("project_id") ?? undefined;
  if (requestedProjectId && !isSafeProjectId(requestedProjectId))
    return response(
      safeError("INVALID_REQUEST", "Invalid project selection"),
      400,
    );

  const runtimeEnv = readRuntimeEnv(env);
  const result = await readProjectContext(
    runtimeEnv,
    requestedProjectId,
    runtimeEnv.SIBYL_ACTIVE_PROJECT_ID,
  );
  if (result.ok) return response(result.data);
  if (result.kind === "not_found")
    return response(
      safeError("PROJECT_CONTEXT_NOT_FOUND", "Project context was not found"),
      404,
    );
  return response(
    safeError("PROJECT_CONTEXT_UNAVAILABLE", "Project context is unavailable"),
    503,
  );
}
