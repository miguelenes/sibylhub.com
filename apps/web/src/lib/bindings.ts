export type RuntimeBindings = {
  DB?: D1Database;
  AST_STORAGE?: R2Bucket;
  VECTORIZE_INDEX?: VectorizeIndex;
};

export type BindingDoubles = {
  db: { all<T>(): Promise<T[]> };
  astStorage: { read(key: string): Promise<string | null> };
  vectorize: { search(vector: number[]): Promise<unknown[]> };
};

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
}> {
  return {
    databaseAvailable: Boolean(bindings?.DB),
    astStorageAvailable: Boolean(bindings?.AST_STORAGE),
    vectorizeAvailable: Boolean(bindings?.VECTORIZE_INDEX),
  };
}
