import {
  isSafeProjectId,
  validateMemoryQueryRequest,
  type MemoryQueryMatch,
  type MemoryQueryResponse,
  type MemoryQueryRequest,
} from "@sibylhub/api-client";
import type { RuntimeBindings } from "./bindings";

export const MEMORY_EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";
const MAX_PREVIEW_LENGTH = 512;
const vectorIdPattern = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;

export type MemoryServiceResult =
  | { ok: true; data: MemoryQueryResponse }
  | { ok: false; kind: "invalid_request" | "unavailable" };

type EmbeddingResponse = { data?: unknown };
type MemoryRow = {
  memory_id: unknown;
  vectorize_id: unknown;
  title: unknown;
  category: unknown;
  content_preview: unknown;
  access_count: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength
    ? value
    : null;
}

function parseEmbedding(value: unknown): number[] | null {
  const data = isRecord(value) ? value.data : value;
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const vector = data[0].filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
  return vector.length > 0 &&
    vector.length <= 4_096 &&
    vector.length === data[0].length
    ? vector
    : null;
}

function mapMemoryMatch(
  row: MemoryRow,
  score: number,
): MemoryQueryMatch | null {
  const id = boundedString(row.memory_id, 160);
  const vectorizeId = boundedString(row.vectorize_id, 160);
  const title = boundedString(row.title, 256);
  const category = boundedString(row.category, 128);
  const preview = boundedString(row.content_preview, MAX_PREVIEW_LENGTH);
  const accessCount = row.access_count;
  if (
    !id ||
    !vectorizeId ||
    !vectorIdPattern.test(vectorizeId) ||
    !title ||
    !category ||
    !preview ||
    typeof accessCount !== "number" ||
    !Number.isSafeInteger(accessCount) ||
    accessCount < 0 ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 1
  )
    return null;
  return { id, title, category, preview, similarityScore: score, accessCount };
}

function noMatches(
  request: MemoryQueryRequest & { limit: number },
  wasTrimmed: boolean,
): MemoryServiceResult {
  return {
    ok: true,
    data: {
      schemaVersion: "1.0",
      status: "no_matches",
      query: { normalized: request.query, wasTrimmed },
      matches: [],
    },
  };
}

export async function queryMemory(
  input: unknown,
  bindings: RuntimeBindings,
  options: { activeProjectId?: string } = {},
): Promise<MemoryServiceResult> {
  const validation = validateMemoryQueryRequest(input);
  if (!validation.valid) return { ok: false, kind: "invalid_request" };
  const request = validation.data;
  const rawQuery =
    isRecord(input) && typeof input.query === "string"
      ? input.query
      : request.query;
  const wasTrimmed = rawQuery !== request.query;

  if (!bindings.AI || !bindings.VECTORIZE_INDEX || !bindings.DB)
    return { ok: false, kind: "unavailable" };
  const projectId = request.projectId ?? options.activeProjectId;
  if (!projectId || !isSafeProjectId(projectId))
    return { ok: false, kind: "unavailable" };

  try {
    const embeddingResponse = await bindings.AI.run<EmbeddingResponse>(
      MEMORY_EMBEDDING_MODEL,
      { text: [request.query] },
    );
    const vector = parseEmbedding(embeddingResponse);
    if (!vector) return { ok: false, kind: "unavailable" };

    const vectorResponse = await bindings.VECTORIZE_INDEX.query(vector, {
      topK: request.limit,
      returnMetadata: "none",
    });
    const vectorMatches = vectorResponse.matches.slice(0, request.limit);
    if (vectorMatches.length === 0) return noMatches(request, wasTrimmed);
    if (
      vectorMatches.some(
        (match) =>
          !vectorIdPattern.test(match.id) ||
          !Number.isFinite(match.score) ||
          match.score < 0 ||
          match.score > 1,
      )
    )
      return { ok: false, kind: "unavailable" };

    const placeholders = vectorMatches.map(() => "?").join(", ");
    const metadata = await bindings.DB.prepare(
      `SELECT memory_id, vectorize_id, title, category, content_preview, access_count
       FROM memory_entries
       WHERE project_id = ? AND active = 1 AND vectorize_id IN (${placeholders})
       ORDER BY memory_id ASC
       LIMIT ${request.limit}`,
    )
      .bind(projectId, ...vectorMatches.map((match) => match.id))
      .all<MemoryRow>();
    if (metadata.results.length !== vectorMatches.length)
      return { ok: false, kind: "unavailable" };

    const rowsByVectorId = new Map(
      metadata.results.map((row) => [row.vectorize_id, row]),
    );
    const matches = vectorMatches.map((vectorMatch) => {
      const row = rowsByVectorId.get(vectorMatch.id);
      return row ? mapMemoryMatch(row, vectorMatch.score) : null;
    });
    if (matches.some((match) => match === null))
      return { ok: false, kind: "unavailable" };

    return {
      ok: true,
      data: {
        schemaVersion: "1.0",
        status: "matches",
        query: { normalized: request.query, wasTrimmed },
        matches: matches as MemoryQueryMatch[],
      },
    };
  } catch {
    return { ok: false, kind: "unavailable" };
  }
}
