export const schemaVersions = ["1.0", "2.0"] as const;
export type SchemaVersion = (typeof schemaVersions)[number];
export type LegacySchemaVersion = "1.0";
export type CurrentSchemaVersion = "2.0";

export type Purl = {
  type: string;
  namespace?: string;
  name: string;
  version: string;
  qualifiers?: Record<string, string>;
  subpath?: string;
};
export type LegacyCatalogEntry = { id: string; name: string; purl: Purl };
export type CatalogEntry = LegacyCatalogEntry;
export type LegacyEcosystemLanguage = LegacyCatalogEntry & {
  runtimeId: string;
  packageManagerId: string;
  lockfileId: string;
  builderId: string;
  invariantIds: string[];
  documentationId: string;
};
export type EcosystemLanguage = LegacyEcosystemLanguage;
export type LegacyInvariantRule = {
  id: string;
  name: string;
  languageId: string;
  rule: string;
  evidenceFields: string[];
};
export type InvariantRule = LegacyInvariantRule;
export type LegacyEcosystemDocument = {
  schemaVersion: LegacySchemaVersion;
  revisionId: string;
  languages: LegacyEcosystemLanguage[];
  runtimes: LegacyCatalogEntry[];
  packageManagers: LegacyCatalogEntry[];
  lockfiles: LegacyCatalogEntry[];
  builders: LegacyCatalogEntry[];
  invariants: LegacyInvariantRule[];
  documentation: Array<{ id: string; path: string; title: string }>;
};

export type RegistryIndexLanguage = {
  id: string;
  slug: string;
  name: string;
  path: string;
};
export type RegistryIndexBuilder = { id: string; slug: string; name: string };
export type RegistryIndex = {
  schemaVersion: CurrentSchemaVersion;
  revisionId: string;
  languages: RegistryIndexLanguage[];
  builders: RegistryIndexBuilder[];
};
export type StableRecord = {
  id: string;
  slug: string;
  name: string;
  purl: Purl;
};
export type ProgrammingLanguageRecord = StableRecord & {
  extensions: string[];
  defaultPackageManagerId?: string;
};
export type RuntimeRecord = StableRecord & {
  languageId: string;
  engineType: string;
  versionManager?: string;
};
export type PackageRegistryRecord = StableRecord & {
  homepageUrl?: string;
  apiUrl?: string;
  supportsNamespaces: boolean;
};
export type PackageManagerRecord = StableRecord & {
  languageId: string;
  registryId?: string;
  binary: string;
  manifestFile: string;
  lockfileFile?: string;
  installCommand: string;
  addCommand: string;
};
export type LockfileSpecificationRecord = StableRecord & {
  packageManagerId: string;
  filename: string;
  format: string;
  versionStandard: string;
  frozenInstall: boolean;
};
export type WorkspaceConfigurationRecord = StableRecord & {
  packageManagerId: string;
  manifest: string;
  format: string;
  packageGlob: string;
  isolatedInstall: boolean;
};
export type PackageCategoryRecord = {
  id: string;
  slug: string;
  name: string;
  description?: string;
};
export type PackageRecord = StableRecord & {
  packageManagerId: string;
  categoryId: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  license?: string;
  opinionated: boolean;
  rationale?: string;
};
export type CompatibilityRecord = {
  id: string;
  packageId: string;
  runtimeId: string;
  compatible: boolean;
  notes?: string;
};
export type BuilderRecord = StableRecord & {
  configurationFiles: string[];
  runCommand: string;
  languageIds: string[];
};
export type StackInvariantRecord = {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  approvedPackageId: string;
  bannedPackageId: string;
  runtimeId?: string;
  frameworkPackageId?: string;
  severity: string;
  reason: string;
  replacementExample?: string;
  migrationUrl?: string;
};
export type DocumentationRecord = {
  id: string;
  documentableType: string;
  documentableId: string;
  sourceUrl?: string;
  r2Key?: string;
  contentHash: string;
  tokenCount: number;
  scrapedAt?: string;
};
export type DocumentationChunkRecord = {
  id: string;
  documentationId: string;
  ordinal: number;
  startOffset: number;
  endOffset: number;
  tokenCount: number;
  summary: string;
};
export type LanguageArtifact = {
  schemaVersion: CurrentSchemaVersion;
  revisionId: string;
  language: ProgrammingLanguageRecord;
  runtimes: RuntimeRecord[];
  packageRegistries: PackageRegistryRecord[];
  packageManagers: PackageManagerRecord[];
  lockfileSpecifications: LockfileSpecificationRecord[];
  workspaceConfigurations: WorkspaceConfigurationRecord[];
  packageCategories: PackageCategoryRecord[];
  packages: PackageRecord[];
  compatibilities: CompatibilityRecord[];
  builders: BuilderRecord[];
  invariants: StackInvariantRecord[];
  documentations: DocumentationRecord[];
  documentationChunks: DocumentationChunkRecord[];
};
export type RegistryArtifactSet = {
  index: RegistryIndex;
  languages: Record<string, LanguageArtifact>;
};
export type EcosystemDocument = LanguageArtifact;

export type ManifestEvidence = {
  path: string;
  kind: string;
  languageId: string;
  runtimeId: string;
  packageManagerId?: string;
  lockfileId?: string;
};
export type AgentConfig = {
  schemaVersion: LegacySchemaVersion;
  project: string;
  mode: "declarative";
  runtimeOwners: Record<string, string>;
  safeCommands: string[];
  manifestEvidence: ManifestEvidence[];
  invariantIds: string[];
  remoteMutationRequiresExplicitCommand: true;
  remoteEvidenceIsSeparate: true;
};
export type SkillDefinition = { id: string; scope: string; declarative: true };
export type SkillsDocument = {
  schemaVersion: LegacySchemaVersion;
  skills: SkillDefinition[];
};
export type MemoryEntry = {
  title: string;
  content: string;
  category: string;
};
export type MemoriesDocument = {
  schemaVersion: LegacySchemaVersion;
  memories: MemoryEntry[];
};
export type InvariantDocument = {
  schemaVersion: LegacySchemaVersion;
  rules: Array<{
    id: string;
    kind: string;
    languageId: string;
    evidenceFields: string[];
  }>;
};
export type ValidationIssue = { path: string; code: string; message: string };
export const candidateSchemaVersion = "candidate-ingestion/1.0" as const;
export type CandidateSchemaVersion = typeof candidateSchemaVersion;
export type CandidateSourceKind =
  | "registry"
  | "curated"
  | "repository"
  | "documentation"
  | "classifier"
  | "firecrawl";
export type CandidateRankBasis =
  "global" | "source-ranked" | "seed-ranked" | "curated";
export type CandidateSourceStatus =
  "success" | "partial" | "failed" | "skipped" | "unsupported";
export type CandidateConfidence = "unknown" | "low" | "medium" | "high";

export type CandidateCrawl = {
  id: string;
  startedAt: string;
  completedAt?: string;
  configHash: string;
  classifierVersions: Record<string, string>;
};
export type CandidateSourceCoverage = {
  sourceId: string;
  ecosystem: string;
  status: CandidateSourceStatus;
  rankBasis: CandidateRankBasis;
  seed?: string;
  sourceUrl?: string;
  discovered: number;
  deduplicated: number;
  detailed: number;
  normalized: number;
  classified: number;
  conflicted: number;
  synchronized: number;
  skipped: number;
  failed: number;
};
export type CandidateEvidence = {
  id: string;
  sourceId: string;
  sourceKind: CandidateSourceKind;
  sourceUrl: string;
  retrievedAt: string;
  contentHash: string;
  evidenceType: string;
  locator?: string;
  excerpt?: string;
  rawResponse?: string;
};
export type CandidateDownloadObservation = {
  sourceId: string;
  value: number;
  period: string;
  sampledAt: string;
  priorSample?: number;
  evidenceIds: string[];
};
export type CandidateStarObservation = {
  sourceId: string;
  value: number;
  sampledAt: string;
  repositoryUrl?: string;
  evidenceIds: string[];
};
export type CandidateDetection = {
  kind: "framework" | "category";
  name: string;
  confidence: CandidateConfidence;
  classifierVersion: string;
  rationale: string;
  evidenceIds: string[];
};
export type CandidateChoiceFactor = {
  name: string;
  value?: number;
  weight: number;
  evidenceIds: string[];
};
export type CandidateChoiceAssessment = {
  score?: number;
  status: "advisory" | "insufficient-data" | "review-required";
  summary: string;
  factors: CandidateChoiceFactor[];
  evidenceIds: string[];
};
export type CandidateObservation = {
  kind:
    | "category"
    | "alternative"
    | "comparison"
    | "pro"
    | "con"
    | "opinion"
    | "repository"
    | "license"
    | "stars";
  value: string | number;
  sourceId: string;
  evidenceIds: string[];
};
export type CandidateResolution = {
  status: "unresolved" | "partial" | "resolved";
  packageManagerId?: string;
  packageCategoryId?: string;
};
export type CandidateRank = {
  sourceId: string;
  basis: CandidateRankBasis;
  position?: number;
  seed?: string;
};
export type PackageCandidate = {
  candidateId: string;
  ecosystem: string;
  purl: Purl;
  name: string;
  namespace?: string;
  releaseVersion?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  license?: string;
  description?: string;
  keywords?: string[];
  downloads?: CandidateDownloadObservation[];
  stars?: CandidateStarObservation[];
  evidenceIds: string[];
  rank: CandidateRank;
  detections: CandidateDetection[];
  choiceAssessment?: CandidateChoiceAssessment;
  observations?: CandidateObservation[];
  resolution: CandidateResolution;
};
export type CandidateDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  candidateId?: string;
  sourceId?: string;
};
export type CandidateRequestTelemetry = {
  sourceId: string;
  requestClass: string;
  attempts: number;
  status?: number;
  durationMs: number;
  pageOrSeed?: string;
};
export type CandidateTelemetry = {
  discovered: number;
  deduplicated: number;
  detailed: number;
  normalized: number;
  classified: number;
  conflicted: number;
  synchronized: number;
  skipped: number;
  failed: number;
  requests: CandidateRequestTelemetry[];
};
export type CandidateArtifact = {
  artifactKind: "candidate-ingestion";
  schemaVersion: CandidateSchemaVersion;
  crawl: CandidateCrawl;
  sourceCoverage: CandidateSourceCoverage[];
  candidates: PackageCandidate[];
  evidence: CandidateEvidence[];
  diagnostics: CandidateDiagnostic[];
  telemetry: CandidateTelemetry;
  contentIdentity: string;
};

export type ValidationResult<T> =
  | { valid: true; data: T; schemaVersion: string; issues: [] }
  | { valid: false; schemaVersion?: string; issues: ValidationIssue[] };
