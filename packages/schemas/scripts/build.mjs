import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const languages = [
  ["c", "C", "generic"],
  ["cpp", "C++", "generic"],
  ["csharp", "C#", "nuget"],
  ["dart", "Dart", "pub"],
  ["elixir", "Elixir", "hex"],
  ["go", "Go", "golang"],
  ["haskell", "Haskell", "hackage"],
  ["java", "Java", "maven"],
  ["javascript", "JavaScript", "npm"],
  ["kotlin", "Kotlin", "maven"],
  ["lua", "Lua", "generic"],
  ["objective-c", "Objective-C", "generic"],
  ["perl", "Perl", "cpan"],
  ["php", "PHP", "composer"],
  ["python", "Python", "pypi"],
  ["r", "R", "cran"],
  ["ruby", "Ruby", "gem"],
  ["rust", "Rust", "cargo"],
  ["scala", "Scala", "maven"],
  ["swift", "Swift", "generic"],
  ["typescript", "TypeScript", "npm"],
  ["zig", "Zig", "generic"],
  ["shell", "Shell", "generic"],
  ["powershell", "PowerShell", "nuget"],
  ["sql", "SQL", "generic"],
];

const catalogEntry = (id, name, type = "generic") => ({
  id,
  name,
  purl: { type, name: id, version: "managed" },
});
const validEcosystem = {
  schemaVersion: "1.0",
  revisionId: "local-bootstrap-1",
  languages: languages.map(([id, name, purl]) => ({
    ...catalogEntry(id, name, purl),
    runtimeId: `runtime-${id}`,
    packageManagerId: `package-manager-${id}`,
    lockfileId: `lockfile-${id}`,
    builderId: `builder-${id}`,
    invariantIds: [`invariant-${id}`],
    documentationId: `docs-${id}`,
  })),
  runtimes: languages.map(([id, name]) =>
    catalogEntry(`runtime-${id}`, `${name} runtime`),
  ),
  packageManagers: languages.map(([id, name]) =>
    catalogEntry(`package-manager-${id}`, `${name} package manager`),
  ),
  lockfiles: languages.map(([id, name]) =>
    catalogEntry(`lockfile-${id}`, `${name} lockfile`),
  ),
  builders: languages.map(([id, name]) =>
    catalogEntry(`builder-${id}`, `${name} builder`),
  ),
  invariants: languages.map(([id, name]) => ({
    id: `invariant-${id}`,
    name: `${name} baseline`,
    languageId: id,
    rule: "declared-runtime-and-lockfile",
    evidenceFields: ["runtimeId", "lockfileId", "manifestPaths"],
  })),
  documentation: languages.map(([id, name]) => ({
    id: `docs-${id}`,
    path: `docs/languages/${id}.md`,
    title: `${name} ecosystem`,
  })),
};

const stringId = { type: "string", minLength: 1 };
const purl = {
  type: "object",
  required: ["type", "name", "version"],
  properties: {
    type: { type: "string", pattern: "^[a-z0-9][a-z0-9.+-]*$" },
    namespace: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, pattern: "^\\S+$" },
    version: { type: "string", minLength: 1, pattern: "^\\S+$" },
    qualifiers: { type: "object", additionalProperties: { type: "string" } },
    subpath: { type: "string", minLength: 1, pattern: "^\\S+$" },
  },
  additionalProperties: false,
};
const catalogEntrySchema = {
  type: "object",
  required: ["id", "name", "purl"],
  properties: { id: stringId, name: stringId, purl },
  additionalProperties: false,
};
const ecosystem = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sibylhub.com/schema/ecosystem/1.0",
  title: "SibylHub ecosystem document",
  type: "object",
  required: [
    "schemaVersion",
    "revisionId",
    "languages",
    "runtimes",
    "packageManagers",
    "lockfiles",
    "builders",
    "invariants",
    "documentation",
  ],
  properties: {
    schemaVersion: { const: "1.0" },
    revisionId: stringId,
    languages: {
      type: "array",
      minItems: 25,
      maxItems: 25,
      items: {
        ...catalogEntrySchema,
        required: [
          ...catalogEntrySchema.required,
          "runtimeId",
          "packageManagerId",
          "lockfileId",
          "builderId",
          "invariantIds",
          "documentationId",
        ],
        properties: {
          ...catalogEntrySchema.properties,
          runtimeId: stringId,
          packageManagerId: stringId,
          lockfileId: stringId,
          builderId: stringId,
          invariantIds: { type: "array", minItems: 1, items: stringId },
          documentationId: stringId,
        },
      },
    },
    runtimes: {
      type: "array",
      minItems: 25,
      maxItems: 25,
      items: catalogEntrySchema,
    },
    packageManagers: {
      type: "array",
      minItems: 25,
      maxItems: 25,
      items: catalogEntrySchema,
    },
    lockfiles: {
      type: "array",
      minItems: 25,
      maxItems: 25,
      items: catalogEntrySchema,
    },
    builders: {
      type: "array",
      minItems: 25,
      maxItems: 25,
      items: catalogEntrySchema,
    },
    invariants: {
      type: "array",
      minItems: 25,
      maxItems: 25,
      items: {
        type: "object",
        required: ["id", "name", "languageId", "rule", "evidenceFields"],
        properties: {
          id: stringId,
          name: stringId,
          languageId: stringId,
          rule: stringId,
          evidenceFields: { type: "array", minItems: 1, items: stringId },
        },
        additionalProperties: false,
      },
    },
    documentation: {
      type: "array",
      minItems: 25,
      maxItems: 25,
      items: {
        type: "object",
        required: ["id", "path", "title"],
        properties: {
          id: stringId,
          path: { type: "string", pattern: "^docs/" },
          title: stringId,
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

const agentConfig = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sibylhub.com/schema/agent-config/1.0",
  title: "SibylHub agent configuration",
  type: "object",
  required: [
    "schemaVersion",
    "project",
    "mode",
    "runtimeOwners",
    "safeCommands",
    "manifestEvidence",
    "invariantIds",
    "remoteMutationRequiresExplicitCommand",
    "remoteEvidenceIsSeparate",
  ],
  properties: {
    schemaVersion: { const: "1.0" },
    project: stringId,
    mode: { const: "declarative" },
    runtimeOwners: { type: "object", additionalProperties: stringId },
    safeCommands: { type: "array", items: stringId },
    manifestEvidence: {
      type: "array",
      items: {
        type: "object",
        required: ["path", "kind", "languageId", "runtimeId"],
        properties: {
          path: stringId,
          kind: stringId,
          languageId: stringId,
          runtimeId: stringId,
          packageManagerId: stringId,
          lockfileId: stringId,
        },
        additionalProperties: false,
      },
    },
    invariantIds: { type: "array", items: stringId },
    remoteMutationRequiresExplicitCommand: { const: true },
    remoteEvidenceIsSeparate: { const: true },
  },
  additionalProperties: false,
};
const skills = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sibylhub.com/schema/skills/1.0",
  title: "SibylHub skills document",
  type: "object",
  required: ["schemaVersion", "skills"],
  properties: {
    schemaVersion: { const: "1.0" },
    skills: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "scope", "declarative"],
        properties: {
          id: stringId,
          scope: stringId,
          declarative: { const: true },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};
const invariants = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sibylhub.com/schema/invariants/1.0",
  title: "SibylHub invariant rules",
  type: "object",
  required: ["schemaVersion", "rules"],
  properties: {
    schemaVersion: { const: "1.0" },
    rules: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "kind", "languageId", "evidenceFields"],
        properties: {
          id: stringId,
          kind: stringId,
          languageId: stringId,
          evidenceFields: { type: "array", minItems: 1, items: stringId },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

const agentFixture = {
  schemaVersion: "1.0",
  project: "sibylhub",
  mode: "declarative",
  runtimeOwners: { "runtime-typescript": "workspace" },
  safeCommands: ["sibyl check --json"],
  manifestEvidence: [
    {
      path: "package.json",
      kind: "package-manifest",
      languageId: "typescript",
      runtimeId: "runtime-typescript",
      packageManagerId: "package-manager-typescript",
      lockfileId: "lockfile-typescript",
    },
  ],
  invariantIds: ["invariant-typescript"],
  remoteMutationRequiresExplicitCommand: true,
  remoteEvidenceIsSeparate: true,
};
const skillsFixture = {
  schemaVersion: "1.0",
  skills: [
    { id: "local-contract-check", scope: "workspace", declarative: true },
  ],
};
const invariantsFixture = {
  schemaVersion: "1.0",
  rules: validEcosystem.invariants.map(
    ({ id, rule, languageId, evidenceFields }) => ({
      id,
      kind: rule,
      languageId,
      evidenceFields,
    }),
  ),
};

await mkdir(resolve(root, "json-schema"), { recursive: true });
await mkdir(resolve(root, "fixtures"), { recursive: true });
await writeFile(
  resolve(root, "json-schema/ecosystem-1.0.json"),
  `${JSON.stringify(ecosystem, null, 2)}\n`,
);
await writeFile(
  resolve(root, "json-schema/agent-config-1.0.json"),
  `${JSON.stringify(agentConfig, null, 2)}\n`,
);
await writeFile(
  resolve(root, "json-schema/skills-1.0.json"),
  `${JSON.stringify(skills, null, 2)}\n`,
);
await writeFile(
  resolve(root, "json-schema/invariants-1.0.json"),
  `${JSON.stringify(invariants, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/valid-ecosystem.json"),
  `${JSON.stringify(validEcosystem, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/incomplete-ecosystem.json"),
  `${JSON.stringify({ ...validEcosystem, languages: validEcosystem.languages.slice(0, 1) }, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/incompatible-ecosystem.json"),
  `${JSON.stringify({ ...validEcosystem, schemaVersion: "9.9" }, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/unresolved-ecosystem.json"),
  `${JSON.stringify({ ...validEcosystem, languages: validEcosystem.languages.map((language, index) => (index === 0 ? { ...language, runtimeId: "runtime-missing" } : language)) }, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/valid-agent.json"),
  `${JSON.stringify(agentFixture, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/valid-skills.json"),
  `${JSON.stringify(skillsFixture, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/valid-invariants.json"),
  `${JSON.stringify(invariantsFixture, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/unsafe-agent.json"),
  `${JSON.stringify({ ...agentFixture, password: "must-not-parse" }, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/malformed-ecosystem.json"),
  '{"schemaVersion":"1.0","languages":[\n',
);

// The current contract is a revision-scoped split tree. Keep the legacy
// fixture above available for migration/import tests, but generate the 2.0
// tree independently so it cannot accidentally inherit the old payload shape.
const revisionId = `sha256:${"0".repeat(64)}`;
const stable = (id, slug, name, type = "generic") => ({
  id,
  slug,
  name,
  purl: { type, name: slug, version: "managed" },
});
const validRegistry = {
  index: {
    schemaVersion: "2.0",
    revisionId,
    languages: languages.map(([slug, name]) => ({
      id: slug,
      slug,
      name,
      path: `languages/${slug}.json`,
    })),
    builders: languages.map(([slug, name]) => ({
      id: `builder-${slug}`,
      slug: `builder-${slug}`,
      name: `${name} builder`,
    })),
  },
  languages: Object.fromEntries(
    languages.map(([slug, name, purlType]) => {
      const language = {
        ...stable(slug, slug, name, purlType),
        extensions: [`.${slug}`],
      };
      const runtime = {
        ...stable(`runtime-${slug}`, `runtime-${slug}`, `${name} runtime`),
        languageId: slug,
        engineType: "interpreter",
      };
      const manager = {
        ...stable(
          `package-manager-${slug}`,
          `package-manager-${slug}`,
          `${name} package manager`,
        ),
        languageId: slug,
        binary: slug,
        manifestFile: "manifest.json",
        installCommand: `${slug} install`,
        addCommand: `${slug} add`,
      };
      const category = {
        id: `category-${slug}`,
        slug: `category-${slug}`,
        name: "Recommended",
      };
      const packageRecord = {
        ...stable(`package-${slug}`, `package-${slug}`, `${name} package`),
        packageManagerId: manager.id,
        categoryId: category.id,
        opinionated: true,
      };
      const alternatePackage = {
        ...stable(
          `package-alt-${slug}`,
          `package-alt-${slug}`,
          `${name} alternate package`,
        ),
        packageManagerId: manager.id,
        categoryId: category.id,
        opinionated: false,
      };
      return [
        slug,
        {
          schemaVersion: "2.0",
          revisionId,
          language,
          runtimes: [runtime],
          packageRegistries: [],
          packageManagers: [manager],
          lockfileSpecifications: [],
          workspaceConfigurations: [],
          packageCategories: [category],
          packages: [packageRecord, alternatePackage],
          compatibilities: [],
          builders: [
            {
              ...stable(
                `builder-${slug}`,
                `builder-${slug}`,
                `${name} builder`,
              ),
              configurationFiles: ["manifest.json"],
              runCommand: `${slug} build`,
              languageIds: [slug],
            },
          ],
          invariants: [
            {
              id: `invariant-${slug}`,
              slug: `invariant-${slug}`,
              name: `${name} baseline`,
              categoryId: category.id,
              approvedPackageId: packageRecord.id,
              bannedPackageId: alternatePackage.id,
              severity: "warning",
              reason: "Use the managed package contract.",
            },
          ],
          documentations: [
            {
              id: `docs-${slug}`,
              documentableType: "programming_language",
              documentableId: slug,
              contentHash: `sha256:${"0".repeat(64)}`,
              tokenCount: 1,
            },
          ],
          documentationChunks: [],
        },
      ];
    }),
  ),
};
const purl2 = {
  type: "object",
  required: ["type", "name", "version"],
  properties: {
    type: { type: "string", pattern: "^[a-z0-9][a-z0-9.+-]*$" },
    namespace: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, pattern: "^\\S+$" },
    version: { type: "string", minLength: 1, pattern: "^\\S+$" },
    qualifiers: { type: "object", additionalProperties: { type: "string" } },
    subpath: { type: "string", minLength: 1, pattern: "^\\S+$" },
  },
  additionalProperties: false,
};
const stable2 = {
  type: "object",
  required: ["id", "slug", "name", "purl"],
  properties: {
    id: stringId,
    slug: { type: "string", pattern: "^[a-z0-9][a-z0-9-]*$" },
    name: stringId,
    purl: purl2,
  },
  additionalProperties: false,
};
const registryIndex2 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sibylhub.com/schema/ecosystem/2.0/index",
  title: "SibylHub normalized ecosystem index",
  type: "object",
  required: ["schemaVersion", "revisionId", "languages", "builders"],
  properties: {
    schemaVersion: { const: "2.0" },
    revisionId: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    languages: {
      type: "array",
      minItems: 25,
      maxItems: 25,
      items: {
        type: "object",
        required: ["id", "slug", "name", "path"],
        properties: {
          id: stringId,
          slug: stringId,
          name: stringId,
          path: {
            type: "string",
            pattern: "^languages/[a-z0-9][a-z0-9-]*\\.json$",
          },
        },
        additionalProperties: false,
      },
    },
    builders: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "slug", "name"],
        properties: { id: stringId, slug: stringId, name: stringId },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};
const artifactCollections = {
  runtimes: { type: "array", items: stable2 },
  packageRegistries: { type: "array", items: stable2 },
  packageManagers: { type: "array", items: stable2 },
  lockfileSpecifications: { type: "array", items: stable2 },
  workspaceConfigurations: { type: "array", items: stable2 },
  packageCategories: { type: "array", items: { type: "object" } },
  packages: { type: "array", items: stable2 },
  compatibilities: { type: "array", items: { type: "object" } },
  builders: { type: "array", items: stable2 },
  invariants: { type: "array", items: { type: "object" } },
  documentations: { type: "array", items: { type: "object" } },
  documentationChunks: { type: "array", items: { type: "object" } },
};
const languageArtifact2 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sibylhub.com/schema/ecosystem/2.0/language",
  title: "SibylHub normalized ecosystem language artifact",
  type: "object",
  required: [
    "schemaVersion",
    "revisionId",
    "language",
    ...Object.keys(artifactCollections),
  ],
  properties: {
    schemaVersion: { const: "2.0" },
    revisionId: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    language: {
      ...stable2,
      properties: {
        ...stable2.properties,
        extensions: { type: "array", items: { type: "string" } },
      },
      required: [...stable2.required, "extensions"],
    },
    ...artifactCollections,
  },
  additionalProperties: false,
};
await mkdir(resolve(root, "fixtures/valid-registry/data/v1/languages"), {
  recursive: true,
});
await writeFile(
  resolve(root, "json-schema/ecosystem-2.0.json"),
  `${JSON.stringify(registryIndex2, null, 2)}\n`,
);
await writeFile(
  resolve(root, "json-schema/ecosystem-language-2.0.json"),
  `${JSON.stringify(languageArtifact2, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/valid-registry/data/v1/index.json"),
  `${JSON.stringify(validRegistry.index, null, 2)}\n`,
);
await Promise.all(
  Object.entries(validRegistry.languages).map(([slug, artifact]) =>
    writeFile(
      resolve(root, `fixtures/valid-registry/data/v1/languages/${slug}.json`),
      `${JSON.stringify(artifact, null, 2)}\n`,
    ),
  ),
);
await writeFile(
  resolve(root, "fixtures/invalid-registry-identity.json"),
  `${JSON.stringify({ ...validRegistry.index, revisionId: `sha256:${"1".repeat(64)}` }, null, 2)}\n`,
);

const compile = spawnSync(
  "pnpm",
  ["exec", "tsc", "--project", resolve(root, "tsconfig.json")],
  { stdio: "inherit" },
);
if (compile.status !== 0) process.exit(compile.status ?? 1);
console.log("schemas built");
