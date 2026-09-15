import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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
    rule: "declared-runtime-and-lockfile",
  })),
  documentation: languages.map(([id, name]) => ({
    id: `docs-${id}`,
    path: `docs/languages/${id}.md`,
    title: `${name} ecosystem`,
  })),
};
const schema = {
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
    revisionId: { type: "string" },
    languages: { type: "array", minItems: 25, maxItems: 25 },
    runtimes: { type: "array" },
    packageManagers: { type: "array" },
    lockfiles: { type: "array" },
    builders: { type: "array" },
    invariants: { type: "array" },
    documentation: { type: "array" },
  },
  additionalProperties: false,
};
await mkdir(resolve(root, "json-schema"), { recursive: true });
await mkdir(resolve(root, "fixtures"), { recursive: true });
await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(
  resolve(root, "json-schema/ecosystem-1.0.json"),
  `${JSON.stringify(schema, null, 2)}\n`,
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
  resolve(root, "fixtures/unsafe-agent.json"),
  `${JSON.stringify({ schemaVersion: "1.0", project: "invalid", mode: "declarative", runtimeOwners: {}, safeCommands: [], remoteMutationRequiresExplicitCommand: true, remoteEvidenceIsSeparate: true, password: "must-not-parse" }, null, 2)}\n`,
);
await writeFile(
  resolve(root, "fixtures/malformed-ecosystem.json"),
  '{"schemaVersion":"1.0","languages":[\n',
);
await writeFile(
  resolve(root, "dist/index.js"),
  `export * from "../src/index.js";\n`,
);
await writeFile(
  resolve(root, "dist/catalog.js"),
  `export { validEcosystem } from "../src/catalog.js";\n`,
);
console.log("schemas built");
