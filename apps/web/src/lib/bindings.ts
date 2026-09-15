export type RuntimeBindings = {
  DB?: D1Database;
  AST_STORAGE?: R2Bucket;
  VECTORIZE_INDEX?: VectorizeIndex;
  AI?: WorkersAI;
};

export type RuntimeEnv = RuntimeBindings & {
  SIBYL_ENV?: string;
  SIBYL_ACTIVE_PROJECT_ID?: string;
};

export type BindingDoubles = {
  db: { all<T>(): Promise<T[]> };
  astStorage: { read(key: string): Promise<string | null> };
  vectorize: { search(vector: number[]): Promise<unknown[]> };
};

export const localMemoryFixtures = {
  unavailable: {
    status: "unavailable",
    errorCode: "MEMORY_SEARCH_UNAVAILABLE",
  },
  empty: {
    status: "no_matches",
    matches: [],
  },
} as const;

export const localDoubles: BindingDoubles = {
  db: {
    async all() {
      return [];
    },
  },
  astStorage: {
    async read() {
      return null;
    },
  },
  vectorize: {
    async search() {
      return [];
    },
  },
};

export async function readRuntimeBindings(bindings?: RuntimeBindings): Promise<{
  databaseAvailable: boolean;
  astStorageAvailable: boolean;
  vectorizeAvailable: boolean;
  aiAvailable: boolean;
  memorySearchAvailable: boolean;
}> {
  const databaseAvailable = Boolean(bindings?.DB);
  const vectorizeAvailable = Boolean(bindings?.VECTORIZE_INDEX);
  const aiAvailable = Boolean(bindings?.AI);

  return {
    databaseAvailable,
    astStorageAvailable: Boolean(bindings?.AST_STORAGE),
    vectorizeAvailable,
    aiAvailable,
    memorySearchAvailable:
      databaseAvailable && vectorizeAvailable && aiAvailable,
  };
}

export function readRuntimeEnv(locals: unknown): RuntimeEnv {
  if (typeof locals !== "object" || locals === null) return {};
  const runtime = (locals as { runtime?: unknown }).runtime;
  if (typeof runtime !== "object" || runtime === null) return {};
  const env = (runtime as { env?: unknown }).env;
  if (typeof env !== "object" || env === null) return {};
  return env as RuntimeEnv;
}
