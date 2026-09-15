export const schemaVersion = "1.0" as const;

export type Purl = {
  type: string;
  namespace?: string;
  name: string;
  version: string;
  qualifiers?: Record<string, string>;
  subpath?: string;
};

export type CatalogEntry = {
  id: string;
  name: string;
  purl: Purl;
};

export type EcosystemLanguage = CatalogEntry & {
  runtimeId: string;
  packageManagerId: string;
  lockfileId: string;
  builderId: string;
  invariantIds: string[];
  documentationId: string;
};

export type EcosystemDocument = {
  schemaVersion: typeof schemaVersion;
  revisionId: string;
  languages: EcosystemLanguage[];
  runtimes: CatalogEntry[];
  packageManagers: CatalogEntry[];
  lockfiles: CatalogEntry[];
  builders: CatalogEntry[];
  invariants: Array<{ id: string; name: string; rule: string }>;
  documentation: Array<{ id: string; path: string; title: string }>;
};

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult<T> =
  | { valid: true; data: T; schemaVersion: typeof schemaVersion; issues: [] }
  | { valid: false; schemaVersion?: string; issues: ValidationIssue[] };
