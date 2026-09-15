import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const readJson = async (relativePath) =>
  JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
const schemaIds = {
  "ecosystem-1.0.json": "https://sibylhub.com/schema/ecosystem/1.0",
  "agent-config-1.0.json": "https://sibylhub.com/schema/agent-config/1.0",
  "skills-1.0.json": "https://sibylhub.com/schema/skills/1.0",
  "invariants-1.0.json": "https://sibylhub.com/schema/invariants/1.0",
};

for (const [name, id] of Object.entries(schemaIds)) {
  const schema = await readJson(`packages/schemas/json-schema/${name}`);
  if (
    schema.$id !== id ||
    schema.$schema !== "https://json-schema.org/draft/2020-12/schema"
  ) {
    throw new Error(`invalid generated schema metadata: ${name}`);
  }
}

const ecosystem = await readJson(
  "packages/schemas/fixtures/valid-ecosystem.json",
);
const languageIds = ecosystem.languages.map(({ id }) => id);
if (
  ecosystem.schemaVersion !== "1.0" ||
  ecosystem.languages.length !== 25 ||
  new Set(languageIds).size !== 25
) {
  throw new Error(
    "valid ecosystem fixture is not the complete 25-language contract",
  );
}

const incomplete = await readJson(
  "packages/schemas/fixtures/incomplete-ecosystem.json",
);
const incompatible = await readJson(
  "packages/schemas/fixtures/incompatible-ecosystem.json",
);
const unresolved = await readJson(
  "packages/schemas/fixtures/unresolved-ecosystem.json",
);
const unsafeAgent = await readJson(
  "packages/schemas/fixtures/unsafe-agent.json",
);
if (
  incomplete.languages.length >= 25 ||
  incompatible.schemaVersion === "1.0" ||
  unresolved.languages[0].runtimeId === unresolved.runtimes[0]?.id ||
  !/(token|password|secret)/.test(JSON.stringify(unsafeAgent).toLowerCase())
) {
  throw new Error(
    "invalid shared contract fixtures lost their rejection cases",
  );
}
for (const language of ecosystem.languages) {
  if (
    !ecosystem.runtimes.some(({ id }) => id === language.runtimeId) ||
    !ecosystem.lockfiles.some(({ id }) => id === language.lockfileId)
  ) {
    throw new Error(`unresolved ecosystem relationship: ${language.id}`);
  }
}

for (const relativePath of [
  "packages/schemas/fixtures/valid-agent.json",
  "packages/schemas/fixtures/valid-skills.json",
  "packages/schemas/fixtures/valid-invariants.json",
]) {
  const document = await readJson(relativePath);
  if (document.schemaVersion !== "1.0")
    throw new Error(`unsupported fixture version: ${relativePath}`);
}
const generated = await readFile(
  resolve(root, "packages/schemas/dist/index.js"),
  "utf8",
);
if (generated.includes("../src/"))
  throw new Error("generated package imports repository source");
console.log(
  JSON.stringify({
    status: "ok",
    schemas: Object.keys(schemaIds).length,
    languages: languageIds.length,
  }),
);
