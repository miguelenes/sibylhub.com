import { z } from "zod";
import { languageIdentities } from "./catalog.js";
import type {
  AgentConfig,
  EcosystemDocument,
  InvariantDocument,
  LanguageArtifact,
  LegacyEcosystemDocument,
  Purl,
  RegistryArtifactSet,
  RegistryIndex,
  SkillsDocument,
  ValidationIssue,
  ValidationResult,
} from "./types.js";

const purlSchema = z
  .object({
    type: z.string().regex(/^[a-z0-9][a-z0-9.+-]*$/),
    namespace: z.string().min(1).regex(/^\S+$/).optional(),
    name: z.string().min(1).regex(/^\S+$/),
    version: z.string().min(1).regex(/^\S+$/),
    qualifiers: z.record(z.string(), z.string()).optional(),
    subpath: z.string().min(1).regex(/^\S+$/).optional(),
  })
  .strict();
const id = z.string().min(1);
const stable = z
  .object({
    id,
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    name: id,
    purl: purlSchema,
  })
  .strict();
const language = stable.extend({
  extensions: z.array(z.string().regex(/^\.[^\s]+$/)),
  defaultPackageManagerId: id.optional(),
});
const runtime = stable.extend({
  languageId: id,
  engineType: id,
  versionManager: id.optional(),
});
const registry = stable.extend({
  homepageUrl: z.string().url().optional(),
  apiUrl: z.string().url().optional(),
  supportsNamespaces: z.boolean(),
});
const manager = stable.extend({
  languageId: id,
  registryId: id.optional(),
  binary: id,
  manifestFile: id,
  lockfileFile: id.optional(),
  installCommand: id,
  addCommand: id,
});
const lockfile = stable.extend({
  packageManagerId: id,
  filename: id,
  format: id,
  versionStandard: id,
  frozenInstall: z.boolean(),
});
const workspace = stable.extend({
  packageManagerId: id,
  manifest: id,
  format: id,
  packageGlob: id,
  isolatedInstall: z.boolean(),
});
const category = z
  .object({
    id,
    slug: z.string().min(1),
    name: id,
    description: z.string().optional(),
  })
  .strict();
const pkg = stable.extend({
  packageManagerId: id,
  categoryId: id,
  homepageUrl: z.string().url().optional(),
  repositoryUrl: z.string().url().optional(),
  license: id.optional(),
  opinionated: z.boolean(),
  rationale: z.string().optional(),
});
const compatibility = z
  .object({
    id,
    packageId: id,
    runtimeId: id,
    compatible: z.boolean(),
    notes: z.string().optional(),
  })
  .strict();
const builder = stable.extend({
  configurationFiles: z.array(id),
  runCommand: id,
  languageIds: z.array(id),
});
const invariant = z
  .object({
    id,
    slug: z.string().min(1),
    name: id,
    categoryId: id,
    approvedPackageId: id,
    bannedPackageId: id,
    runtimeId: id.optional(),
    frameworkPackageId: id.optional(),
    severity: id,
    reason: id,
    replacementExample: z.string().optional(),
    migrationUrl: z.string().url().optional(),
  })
  .strict();
const documentation = z
  .object({
    id,
    documentableType: id,
    documentableId: id,
    sourceUrl: z.string().url().optional(),
    r2Key: id.optional(),
    contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    tokenCount: z.number().int().nonnegative(),
    scrapedAt: z.string().datetime().optional(),
  })
  .strict();
const chunk = z
  .object({
    id,
    documentationId: id,
    ordinal: z.number().int().nonnegative(),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().nonnegative(),
    tokenCount: z.number().int().nonnegative(),
    summary: id,
  })
  .strict();
const indexSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    revisionId: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    languages: z
      .array(
        z
          .object({
            id,
            slug: z.string().min(1),
            name: id,
            path: z.string().regex(/^languages\/[a-z0-9][a-z0-9-]*\.json$/),
          })
          .strict(),
      )
      .length(25),
    builders: z
      .array(z.object({ id, slug: z.string().min(1), name: id }).strict())
      .min(1),
  })
  .strict();
const artifactSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    revisionId: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    language,
    runtimes: z.array(runtime),
    packageRegistries: z.array(registry),
    packageManagers: z.array(manager),
    lockfileSpecifications: z.array(lockfile),
    workspaceConfigurations: z.array(workspace),
    packageCategories: z.array(category),
    packages: z.array(pkg),
    compatibilities: z.array(compatibility),
    builders: z.array(builder),
    invariants: z.array(invariant),
    documentations: z.array(documentation),
    documentationChunks: z.array(chunk),
  })
  .strict();
const legacyCatalog = z.object({ id, name: id, purl: purlSchema }).strict();
const legacySchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    revisionId: id,
    languages: z
      .array(
        legacyCatalog.extend({
          runtimeId: id,
          packageManagerId: id,
          lockfileId: id,
          builderId: id,
          invariantIds: z.array(id).min(1),
          documentationId: id,
        }),
      )
      .length(25),
    runtimes: z.array(legacyCatalog).length(25),
    packageManagers: z.array(legacyCatalog).length(25),
    lockfiles: z.array(legacyCatalog).length(25),
    builders: z.array(legacyCatalog).length(25),
    invariants: z
      .array(
        z
          .object({
            id,
            name: id,
            languageId: id,
            rule: id,
            evidenceFields: z.array(id).min(1),
          })
          .strict(),
      )
      .length(25),
    documentation: z
      .array(
        z
          .object({ id, path: z.string().startsWith("docs/"), title: id })
          .strict(),
      )
      .length(25),
  })
  .strict();
const manifestEvidence = z
  .object({
    path: id,
    kind: id,
    languageId: id,
    runtimeId: id,
    packageManagerId: id.optional(),
    lockfileId: id.optional(),
  })
  .strict();
const agentSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    project: id,
    mode: z.literal("declarative"),
    runtimeOwners: z.record(z.string(), id),
    safeCommands: z.array(id),
    manifestEvidence: z.array(manifestEvidence),
    invariantIds: z.array(id),
    remoteMutationRequiresExplicitCommand: z.literal(true),
    remoteEvidenceIsSeparate: z.literal(true),
  })
  .strict();
const skillsSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    skills: z.array(
      z.object({ id, scope: id, declarative: z.literal(true) }).strict(),
    ),
  })
  .strict();
const invariantsSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    rules: z.array(
      z
        .object({
          id,
          kind: id,
          languageId: id,
          evidenceFields: z.array(id).min(1),
        })
        .strict(),
    ),
  })
  .strict();

function rejectUnsafe(input: unknown): ValidationIssue[] {
  const serialized = JSON.stringify(input);
  return (
    [
      [
        "secret_value",
        /["']?(password|token|secret|authorization)["']?\s*[:=]\s*["']?[^,}\\"']+/i,
      ],
      ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
      [
        "executable_directive",
        /(^|["'])\s*(command|exec|script|shell)\s*["']\s*:/i,
      ],
    ] as const
  )
    .filter(([, pattern]) => pattern.test(serialized))
    .map(([code]) => ({
      path: "$",
      code,
      message: "Unsafe content is not accepted in declarative contracts",
    }));
}
function parse<T>(
  schema: z.ZodType<T>,
  input: unknown,
  version?: string,
): ValidationResult<T> {
  const unsafe = rejectUnsafe(input);
  if (unsafe.length)
    return { valid: false, schemaVersion: version, issues: unsafe };
  const result = schema.safeParse(input);
  if (!result.success)
    return {
      valid: false,
      schemaVersion: version,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    };
  return {
    valid: true,
    data: result.data,
    schemaVersion: version as "1.0" | "2.0",
    issues: [],
  };
}
const versionOf = (input: unknown) =>
  typeof input === "object" && input !== null && "schemaVersion" in input
    ? String((input as { schemaVersion: unknown }).schemaVersion)
    : undefined;
const referenceIssues = (
  index: RegistryIndex,
  files: Record<string, LanguageArtifact>,
): ValidationIssue[] => {
  const result: ValidationIssue[] = [];
  const expected = new Set(languageIdentities);
  const actual = new Set(index.languages.map((item) => item.id));
  for (const value of languageIdentities)
    if (!actual.has(value))
      result.push({
        path: "index.languages",
        code: "missing_language",
        message: `Missing language identity ${value}`,
      });
  for (const value of actual)
    if (!expected.has(value as (typeof languageIdentities)[number]))
      result.push({
        path: "index.languages",
        code: "unsupported_language",
        message: `Unsupported language identity ${value}`,
      });
  if (actual.size !== index.languages.length)
    result.push({
      path: "index.languages",
      code: "duplicate_identifier",
      message: "The index contains duplicate language identifiers",
    });
  for (const item of index.languages) {
    const file = files[item.id];
    if (!file) {
      result.push({
        path: `languages.${item.id}`,
        code: "missing_file",
        message: `Missing language artifact ${item.path}`,
      });
      continue;
    }
    if (item.path !== `languages/${item.slug}.json`)
      result.push({
        path: `languages.${item.id}.path`,
        code: "invalid_path",
        message: "Language path must match its canonical slug",
      });
    if (
      file.revisionId !== index.revisionId ||
      file.language.id !== item.id ||
      file.language.slug !== item.slug
    )
      result.push({
        path: `languages.${item.id}`,
        code: "identity_mismatch",
        message: "Index and language artifact identities must match",
      });
    const packages = new Set(file.packages.map((value) => value.id));
    for (const value of file.invariants) {
      if (value.approvedPackageId === value.bannedPackageId)
        result.push({
          path: `languages.${item.id}.invariants`,
          code: "equal_invariant_packages",
          message: "Approved and banned packages must differ",
        });
      if (
        !packages.has(value.approvedPackageId) ||
        !packages.has(value.bannedPackageId)
      )
        result.push({
          path: `languages.${item.id}.invariants`,
          code: "unresolved_reference",
          message: "Invariant package reference is unresolved",
        });
    }
  }
  return result;
};

export function validateRegistryIndex(
  input: unknown,
): ValidationResult<RegistryIndex> {
  return parse(indexSchema, input, versionOf(input));
}
export function validateLanguageArtifact(
  input: unknown,
): ValidationResult<LanguageArtifact> {
  return parse(artifactSchema, input, versionOf(input));
}
export function validateRegistryArtifactSet(input: {
  index: unknown;
  languages: Record<string, unknown>;
}): ValidationResult<RegistryArtifactSet> {
  const index = validateRegistryIndex(input.index);
  if (!index.valid)
    return { valid: false, schemaVersion: "2.0", issues: index.issues };
  const languages: Record<string, LanguageArtifact> = {};
  const errors: ValidationIssue[] = [];
  for (const [slug, value] of Object.entries(input.languages)) {
    const artifact = validateLanguageArtifact(value);
    if (artifact.valid) languages[slug] = artifact.data;
    else
      errors.push(
        ...artifact.issues.map((issue) => ({
          ...issue,
          path: `languages.${slug}.${issue.path}`,
        })),
      );
  }
  errors.push(...referenceIssues(index.data, languages));
  return errors.length
    ? { valid: false, schemaVersion: "2.0", issues: errors }
    : {
        valid: true,
        data: { index: index.data, languages },
        schemaVersion: "2.0",
        issues: [],
      };
}
export const validateSplitRegistry = validateRegistryArtifactSet;
export function validateLegacyEcosystem(
  input: unknown,
): ValidationResult<LegacyEcosystemDocument> {
  const result = parse(legacySchema, input, versionOf(input));
  if (!result.valid) return result;
  const ids = new Set(result.data.languages.map((value) => value.id));
  const errors = result.data.invariants
    .filter((value) => !ids.has(value.languageId))
    .map((value) => ({
      path: "invariants",
      code: "unresolved_reference",
      message: `Unknown language ${value.languageId}`,
    }));
  return errors.length
    ? { valid: false, schemaVersion: "1.0", issues: errors }
    : result;
}
export function validateEcosystem(
  input: unknown,
): ValidationResult<EcosystemDocument> {
  return validateLanguageArtifact(input);
}
export function validatePurl(input: unknown): ValidationResult<Purl> {
  return parse(purlSchema, input, "2.0");
}
export function validateAgentConfig(
  input: unknown,
): ValidationResult<AgentConfig> {
  return parse(agentSchema, input, "1.0");
}
export function validateSkills(
  input: unknown,
): ValidationResult<SkillsDocument> {
  return parse(skillsSchema, input, "1.0");
}
export function validateInvariants(
  input: unknown,
): ValidationResult<InvariantDocument> {
  return parse(invariantsSchema, input, "1.0");
}
export function normalizePurl(input: Purl): Purl {
  return {
    ...input,
    type: input.type.toLowerCase(),
    namespace: input.namespace?.trim() || undefined,
    name: input.name.trim(),
    version: input.version.trim(),
    qualifiers: input.qualifiers
      ? Object.fromEntries(
          Object.entries(input.qualifiers).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : undefined,
    subpath: input.subpath?.trim() || undefined,
  };
}
