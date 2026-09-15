import type { EcosystemDocument } from "./types.js";

const languageNames = [
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

const purlType: Record<string, string> = {
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

const entry = (id: string, name: string, kind: string) => ({
  id,
  name,
  purl: { type: kind, name: id, version: "managed" },
});

export const validEcosystem: EcosystemDocument = {
  schemaVersion: "1.0",
  revisionId: "local-bootstrap-1",
  languages: languageNames.map(([id, name]) => ({
    ...entry(id, name, purlType[id]),
    runtimeId: `runtime-${id}`,
    packageManagerId: `package-manager-${id}`,
    lockfileId: `lockfile-${id}`,
    builderId: `builder-${id}`,
    invariantIds: [`invariant-${id}`],
    documentationId: `docs-${id}`,
  })),
  runtimes: languageNames.map(([id, name]) =>
    entry(`runtime-${id}`, `${name} runtime`, "generic"),
  ),
  packageManagers: languageNames.map(([id, name]) =>
    entry(`package-manager-${id}`, `${name} package manager`, "generic"),
  ),
  lockfiles: languageNames.map(([id, name]) =>
    entry(`lockfile-${id}`, `${name} lockfile`, "generic"),
  ),
  builders: languageNames.map(([id, name]) =>
    entry(`builder-${id}`, `${name} builder`, "generic"),
  ),
  invariants: languageNames.map(([id, name]) => ({
    id: `invariant-${id}`,
    name: `${name} baseline`,
    rule: "declared-runtime-and-lockfile",
  })),
  documentation: languageNames.map(([id, name]) => ({
    id: `docs-${id}`,
    path: `docs/languages/${id}.md`,
    title: `${name} ecosystem`,
  })),
};

export const languageIdentities = languageNames.map(([id]) => id);
