import type {
  LegacyEcosystemDocument,
  LegacyInvariantRule,
  RegistryArtifactSet,
} from "./types.js";

export const languageNames = [
  ["c", "C"],
  ["cpp", "C++"],
  ["csharp", "C#"],
  ["dart", "Dart"],
  ["elixir", "Elixir"],
  ["go", "Go"],
  ["haskell", "Haskell"],
  ["java", "Java"],
  ["javascript", "JavaScript"],
  ["kotlin", "Kotlin"],
  ["lua", "Lua"],
  ["objective-c", "Objective-C"],
  ["perl", "Perl"],
  ["php", "PHP"],
  ["python", "Python"],
  ["r", "R"],
  ["ruby", "Ruby"],
  ["rust", "Rust"],
  ["scala", "Scala"],
  ["swift", "Swift"],
  ["typescript", "TypeScript"],
  ["zig", "Zig"],
  ["shell", "Shell"],
  ["powershell", "PowerShell"],
  ["sql", "SQL"],
] as const;
export const purlTypes: Record<string, string> = {
  c: "generic",
  cpp: "generic",
  csharp: "nuget",
  dart: "pub",
  elixir: "hex",
  go: "golang",
  haskell: "hackage",
  java: "maven",
  javascript: "npm",
  kotlin: "maven",
  lua: "generic",
  "objective-c": "generic",
  perl: "cpan",
  php: "composer",
  python: "pypi",
  r: "cran",
  ruby: "gem",
  rust: "cargo",
  scala: "maven",
  swift: "generic",
  typescript: "npm",
  zig: "generic",
  shell: "generic",
  powershell: "nuget",
  sql: "generic",
};
export const languageIdentities = languageNames.map(([id]) => id);
const legacyEntry = (id: string, name: string, type = "generic") => ({
  id,
  name,
  purl: { type, name: id, version: "managed" },
});
export const validLegacyEcosystem: LegacyEcosystemDocument = {
  schemaVersion: "1.0",
  revisionId: "local-bootstrap-1",
  languages: languageNames.map(([id, name]) => ({
    ...legacyEntry(id, name, purlTypes[id]),
    runtimeId: `runtime-${id}`,
    packageManagerId: `package-manager-${id}`,
    lockfileId: `lockfile-${id}`,
    builderId: `builder-${id}`,
    invariantIds: [`invariant-${id}`],
    documentationId: `docs-${id}`,
  })),
  runtimes: languageNames.map(([id, name]) =>
    legacyEntry(`runtime-${id}`, `${name} runtime`),
  ),
  packageManagers: languageNames.map(([id, name]) =>
    legacyEntry(`package-manager-${id}`, `${name} package manager`),
  ),
  lockfiles: languageNames.map(([id, name]) =>
    legacyEntry(`lockfile-${id}`, `${name} lockfile`),
  ),
  builders: languageNames.map(([id, name]) =>
    legacyEntry(`builder-${id}`, `${name} builder`),
  ),
  invariants: languageNames.map(([id, name]): LegacyInvariantRule => ({
    id: `invariant-${id}`,
    name: `${name} baseline`,
    languageId: id,
    rule: "declared-runtime-and-lockfile",
    evidenceFields: ["runtimeId", "lockfileId", "manifestPaths"],
  })),
  documentation: languageNames.map(([id, name]) => ({
    id: `docs-${id}`,
    path: `docs/languages/${id}.md`,
    title: `${name} ecosystem`,
  })),
};
export const validEcosystem = validLegacyEcosystem;
const stable = (id: string, slug: string, name: string, type = "generic") => ({
  id,
  slug,
  name,
  purl: { type, name: slug, version: "managed" },
});
export const validRegistry: RegistryArtifactSet = (() => {
  const revisionId = "sha256:" + "0".repeat(64);
  const languages = Object.fromEntries(
    languageNames.map(([slug, name]) => {
      const language = {
        ...stable(slug, slug, name, purlTypes[slug]),
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
      const pkg = {
        ...stable(`package-${slug}`, `package-${slug}`, `${name} package`),
        packageManagerId: manager.id,
        categoryId: category.id,
        opinionated: true,
      };
      const alternate = {
        ...stable(
          `package-alt-${slug}`,
          `package-alt-${slug}`,
          `${name} alternate package`,
        ),
        packageManagerId: manager.id,
        categoryId: category.id,
        opinionated: false,
      };
      const invariant = {
        id: `invariant-${slug}`,
        slug: `invariant-${slug}`,
        name: `${name} baseline`,
        categoryId: category.id,
        approvedPackageId: pkg.id,
        bannedPackageId: alternate.id,
        severity: "warning",
        reason: "Use the managed package contract.",
      };
      const builder = {
        ...stable(`builder-${slug}`, `builder-${slug}`, `${name} builder`),
        configurationFiles: ["manifest.json"],
        runCommand: `${slug} build`,
        languageIds: [slug],
      };
      const documentation = {
        id: `docs-${slug}`,
        documentableType: "programming_language",
        documentableId: slug,
        contentHash: "sha256:" + "0".repeat(64),
        tokenCount: 1,
      };
      return [
        slug,
        {
          schemaVersion: "2.0" as const,
          revisionId,
          language,
          runtimes: [runtime],
          packageRegistries: [],
          packageManagers: [manager],
          lockfileSpecifications: [],
          workspaceConfigurations: [],
          packageCategories: [category],
          packages: [pkg, alternate],
          compatibilities: [],
          builders: [builder],
          invariants: [invariant],
          documentations: [documentation],
          documentationChunks: [],
        },
      ];
    }),
  );
  const index = {
    schemaVersion: "2.0" as const,
    revisionId,
    languages: languageNames.map(([slug, name]) => ({
      id: slug,
      slug,
      name,
      path: `languages/${slug}.json`,
    })),
    builders: languageNames.map(([slug, name]) => ({
      id: `builder-${slug}`,
      slug: `builder-${slug}`,
      name: `${name} builder`,
    })),
  };
  return { index, languages };
})();
export function invariantForLanguage(
  languageId: string,
): LegacyInvariantRule | undefined {
  return validLegacyEcosystem.invariants.find(
    (invariant) => invariant.languageId === languageId,
  );
}
