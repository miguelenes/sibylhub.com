import { z } from "zod";
import { languageIdentities } from "./catalog.js";
import type {
  AgentConfig,
  EcosystemDocument,
  InvariantDocument,
  Purl,
  SkillsDocument,
  ValidationIssue,
  ValidationResult,
} from "./types.js";

const purlSchema = z
  .object({
    type: z.string().regex(/^[a-z0-9][a-z0-9.+-]*$/),
    namespace: z
      .string()
      .min(1)
      .regex(/^[^\s]+$/)
      .optional(),
    name: z
      .string()
      .min(1)
      .regex(/^[^\s]+$/),
    version: z
      .string()
      .min(1)
      .regex(/^[^\s]+$/),
    qualifiers: z.record(z.string(), z.string()).optional(),
    subpath: z
      .string()
      .min(1)
      .regex(/^[^\s]+$/)
      .optional(),
  })
  .strict();

const catalogEntrySchema = z
  .object({ id: z.string().min(1), name: z.string().min(1), purl: purlSchema })
  .strict();

const ecosystemSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    revisionId: z.string().min(1),
    languages: z
      .array(
        catalogEntrySchema.extend({
          runtimeId: z.string().min(1),
          packageManagerId: z.string().min(1),
          lockfileId: z.string().min(1),
          builderId: z.string().min(1),
          invariantIds: z.array(z.string().min(1)).min(1),
          documentationId: z.string().min(1),
        }),
      )
      .length(25),
    runtimes: z.array(catalogEntrySchema).length(25),
    packageManagers: z.array(catalogEntrySchema).length(25),
    lockfiles: z.array(catalogEntrySchema).length(25),
    builders: z.array(catalogEntrySchema).length(25),
    invariants: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().min(1),
            languageId: z.string().min(1),
            rule: z.string().min(1),
            evidenceFields: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .length(25),
    documentation: z
      .array(
        z
          .object({
            id: z.string().min(1),
            path: z.string().startsWith("docs/"),
            title: z.string().min(1),
          })
          .strict(),
      )
      .length(25),
  })
  .strict();

const manifestEvidenceSchema = z
  .object({
    path: z.string().min(1),
    kind: z.string().min(1),
    languageId: z.string().min(1),
    runtimeId: z.string().min(1),
    packageManagerId: z.string().min(1).optional(),
    lockfileId: z.string().min(1).optional(),
  })
  .strict();

const agentConfigSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    project: z.string().min(1),
    mode: z.literal("declarative"),
    runtimeOwners: z.record(z.string(), z.string().min(1)),
    safeCommands: z.array(z.string().min(1)),
    manifestEvidence: z.array(manifestEvidenceSchema),
    invariantIds: z.array(z.string().min(1)),
    remoteMutationRequiresExplicitCommand: z.literal(true),
    remoteEvidenceIsSeparate: z.literal(true),
  })
  .strict();

const skillsSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    skills: z.array(
      z
        .object({
          id: z.string().min(1),
          scope: z.string().min(1),
          declarative: z.literal(true),
        })
        .strict(),
    ),
  })
  .strict();

const invariantSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    rules: z.array(
      z
        .object({
          id: z.string().min(1),
          kind: z.string().min(1),
          languageId: z.string().min(1),
          evidenceFields: z.array(z.string().min(1)).min(1),
        })
        .strict(),
    ),
  })
  .strict();

function issues(
  error: z.ZodError,
  schemaVersion?: string,
): ValidationResult<never> {
  const mapped: ValidationIssue[] = error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
  return { valid: false, schemaVersion, issues: mapped };
}

function rejectUnsafe(input: unknown): ValidationIssue[] {
  const serialized = JSON.stringify(input);
  const patterns: Array<[string, RegExp]> = [
    [
      "secret_value",
      /["']?(password|token|secret|authorization)["']?\s*[:=]\s*["']?[^,}\"']+/i,
    ],
    ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
    [
      "executable_directive",
      /(^|["'])\s*(command|exec|script|shell)\s*["']\s*:/i,
    ],
  ];
  return patterns
    .filter(([, pattern]) => pattern.test(serialized))
    .map(([code]) => ({
      path: "$",
      code,
      message: "Unsafe content is not accepted in declarative contracts",
    }));
}

function validate<T>(
  schema: z.ZodType<T>,
  input: unknown,
): ValidationResult<T> {
  const unsafe = rejectUnsafe(input);
  const schemaVersion =
    typeof input === "object" && input && "schemaVersion" in input
      ? String((input as { schemaVersion: unknown }).schemaVersion)
      : undefined;
  if (unsafe.length) return { valid: false, schemaVersion, issues: unsafe };
  const result = schema.safeParse(input);
  if (!result.success)
    return issues(result.error, schemaVersion) as ValidationResult<T>;
  return { valid: true, data: result.data, schemaVersion: "1.0", issues: [] };
}

function referencesExist(document: EcosystemDocument): ValidationIssue[] {
  const sets = new Map([
    ["runtimeId", new Set(document.runtimes.map((item) => item.id))],
    [
      "packageManagerId",
      new Set(document.packageManagers.map((item) => item.id)),
    ],
    ["lockfileId", new Set(document.lockfiles.map((item) => item.id))],
    ["builderId", new Set(document.builders.map((item) => item.id))],
    ["documentationId", new Set(document.documentation.map((item) => item.id))],
    ["invariantId", new Set(document.invariants.map((item) => item.id))],
  ]);
  const result: ValidationIssue[] = [];
  const expectedLanguages = new Set(languageIdentities);
  const actualLanguages = new Set(
    document.languages.map((language) => language.id),
  );
  for (const languageId of languageIdentities) {
    if (!actualLanguages.has(languageId))
      result.push({
        path: "languages",
        code: "missing_language",
        message: `Missing language identity ${languageId}`,
      });
  }
  for (const languageId of actualLanguages) {
    if (
      !expectedLanguages.has(languageId as (typeof languageIdentities)[number])
    )
      result.push({
        path: "languages",
        code: "unsupported_language",
        message: `Unsupported language identity ${languageId}`,
      });
  }
  const collections = [
    ["languages", document.languages],
    ["runtimes", document.runtimes],
    ["packageManagers", document.packageManagers],
    ["lockfiles", document.lockfiles],
    ["builders", document.builders],
    ["invariants", document.invariants],
    ["documentation", document.documentation],
  ] as const;
  for (const [collection, values] of collections) {
    const ids = values.map((value) => value.id);
    if (new Set(ids).size !== ids.length)
      result.push({
        path: collection,
        code: "duplicate_identifier",
        message: `The ${collection} collection contains duplicate identifiers`,
      });
  }
  document.languages.forEach((language, index) => {
    for (const field of [
      "runtimeId",
      "packageManagerId",
      "lockfileId",
      "builderId",
      "documentationId",
    ] as const) {
      if (!sets.get(field)?.has(language[field]))
        result.push({
          path: `languages.${index}.${field}`,
          code: "unresolved_reference",
          message: `Unknown ${field} ${language[field]}`,
        });
    }
    language.invariantIds.forEach((id) => {
      if (!sets.get("invariantId")?.has(id))
        result.push({
          path: `languages.${index}.invariantIds`,
          code: "unresolved_reference",
          message: `Unknown invariant ${id}`,
        });
    });
    if (
      !document.invariants.some(
        (invariant) => invariant.languageId === language.id,
      )
    )
      result.push({
        path: `languages.${index}.invariantIds`,
        code: "missing_invariant_relationship",
        message: `No invariant rule is associated with ${language.id}`,
      });
  });
  document.invariants.forEach((invariant, index) => {
    if (
      !expectedLanguages.has(
        invariant.languageId as (typeof languageIdentities)[number],
      )
    )
      result.push({
        path: `invariants.${index}.languageId`,
        code: "unresolved_reference",
        message: `Unknown language ${invariant.languageId}`,
      });
  });
  return result;
}

export function validateEcosystem(
  input: unknown,
): ValidationResult<EcosystemDocument> {
  const result = validate(ecosystemSchema, input);
  if (!result.valid) return result;
  const relationshipIssues = referencesExist(result.data);
  return relationshipIssues.length
    ? { valid: false, schemaVersion: "1.0", issues: relationshipIssues }
    : result;
}

export function validatePurl(input: unknown): ValidationResult<Purl> {
  return validate(purlSchema, input);
}

export function validateAgentConfig(
  input: unknown,
): ValidationResult<AgentConfig> {
  return validate(agentConfigSchema, input);
}

export function validateSkills(
  input: unknown,
): ValidationResult<SkillsDocument> {
  return validate(skillsSchema, input);
}

export function validateInvariants(
  input: unknown,
): ValidationResult<InvariantDocument> {
  return validate(invariantSchema, input);
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
          Object.entries(input.qualifiers).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        )
      : undefined,
    subpath: input.subpath?.trim() || undefined,
  };
}
