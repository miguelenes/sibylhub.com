/// <reference types="astro/client" />

declare module "cloudflare:workers" {
  export const env: import("./lib/bindings").RuntimeEnv;
}

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};
type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: unknown }>;
};
type R2Bucket = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
};
type WorkersAI = {
  run<T = unknown>(model: string, input: unknown): Promise<T>;
};
type VectorizeMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};
type VectorizeQueryOptions = {
  topK?: number;
  returnMetadata?: "none" | "indexed" | "all";
};
type VectorizeQueryResult = {
  matches: VectorizeMatch[];
};
type VectorizeIndex = {
  query(
    vector: number[],
    options?: VectorizeQueryOptions,
  ): Promise<VectorizeQueryResult>;
};

interface ImportMetaEnv {
  readonly PUBLIC_SIBYL_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
