/// <reference types="astro/client" />

type D1Database = {
  prepare(query: string): { all<T>(): Promise<{ results: T[] }> };
};
type R2Bucket = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
};
type VectorizeIndex = {
  query(vector: number[], options?: unknown): Promise<unknown>;
};

interface ImportMetaEnv {
  readonly PUBLIC_SIBYL_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
