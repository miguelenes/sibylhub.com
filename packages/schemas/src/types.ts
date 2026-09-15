export const schemaVersion = "1.0" as const;
export type SchemaVersion = typeof schemaVersion;

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
  schemaVersion: SchemaVersion;
  revisionId: string;
  languages: EcosystemLanguage[];
  runtimes: CatalogEntry[];
  packageManagers: CatalogEntry[];
  lockfiles: CatalogEntry[];
  builders: CatalogEntry[];
  invariants: InvariantRule[];
  documentation: Array<{ id: string; path: string; title: string }>;
};

export type InvariantRule = {
  id: string;
  name: string;
  languageId: string;
  rule: "declared-runtime-and-lockfile" | string;
  evidenceFields: string[];
};

export type ManifestEvidence = {
  path: string;
  kind: string;
  languageId: string;
  runtimeId: string;
  packageManagerId?: string;
  lockfileId?: string;
};

export type AgentConfig = {
  schemaVersion: SchemaVersion;
  project: string;
  mode: "declarative";
  runtimeOwners: Record<string, string>;
  safeCommands: string[];
  manifestEvidence: ManifestEvidence[];
  invariantIds: string[];
  remoteMutationRequiresExplicitCommand: true;
  remoteEvidenceIsSeparate: true;
};

export type SkillDefinition = {
  id: string;
  scope: string;
  declarative: true;
};

export type SkillsDocument = {
  schemaVersion: SchemaVersion;
  skills: SkillDefinition[];
};

export type InvariantDocument = {
  schemaVersion: SchemaVersion;
  rules: Array<{
    id: string;
    kind: string;
    languageId: string;
    evidenceFields: string[];
  }>;
};

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult<T> =
  | { valid: true; data: T; schemaVersion: SchemaVersion; issues: [] }
  | { valid: false; schemaVersion?: string; issues: ValidationIssue[] };
