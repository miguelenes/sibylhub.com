import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const requiredPaths = [
  "package.json",
  "pnpm-workspace.yaml",
  "Cargo.toml",
  "packages/schemas/package.json",
  "packages/schemas/json-schema/ecosystem-1.0.json",
  "packages/schemas/json-schema/candidate-ingestion-1.0.json",
  "packages/schemas/json-schema/agent-config-1.0.json",
  "packages/schemas/json-schema/skills-1.0.json",
  "packages/schemas/json-schema/invariants-1.0.json",
  "packages/schemas/fixtures/valid-ecosystem.json",
  "packages/schemas/fixtures/valid-candidate-ingestion.json",
  "packages/schemas/fixtures/unsafe-candidate-ingestion.json",
  "packages/schemas/fixtures/unsupported-candidate-ingestion.json",
  "packages/schemas/fixtures/valid-agent.json",
  "packages/schemas/fixtures/valid-skills.json",
  "packages/schemas/fixtures/valid-invariants.json",
  "packages/typescript-config/package.json",
  "packages/design-system/package.json",
  "apps/web/package.json",
  "apps/web/wrangler.toml",
  "apps/backoffice/package.json",
  "apps/backend/Cargo.toml",
  "apps/cli/Cargo.toml",
  "apps/docs/package.json",
  ".agent/config.json",
  ".agent/skills.json",
  ".nvmrc",
  "rust-toolchain.toml",
];

const missing = requiredPaths.filter((path) => !existsSync(join(root, path)));
if (missing.length > 0) {
  console.error(
    JSON.stringify({ code: "missing_local_contract", missing }, null, 2),
  );
  process.exit(1);
}

const rootPackage = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);
const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
const wrangler = readFileSync(join(root, "apps/web/wrangler.toml"), "utf8");
const requiredScripts = [
  "dev",
  "dev:web",
  "dev:backend",
  "build",
  "test",
  "lint",
  "format",
  "typecheck",
  "test:cov",
  "clean",
  "check:config",
];
const missingScripts = requiredScripts.filter(
  (script) => !rootPackage.scripts?.[script],
);
const bindings = ["DB", "AST_STORAGE", "VECTORIZE_INDEX"].filter(
  (binding) => !wrangler.includes(`binding = \"${binding}\"`),
);
const runtimePins = {
  packageManager: rootPackage.packageManager === "pnpm@9.15.9",
  node: readFileSync(join(root, ".nvmrc"), "utf8").trim() === "22.12.0",
  rust: readFileSync(join(root, "rust-toolchain.toml"), "utf8").includes(
    'channel = "1.98.1"',
  ),
};

if (
  !workspace.includes('"apps/*"') ||
  !workspace.includes('"packages/*"') ||
  missingScripts.length ||
  bindings.length ||
  Object.values(runtimePins).some((valid) => !valid)
) {
  console.error(
    JSON.stringify(
      {
        code: "invalid_local_contract",
        missingScripts,
        missingBindings: bindings,
        runtimePins,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: "ok",
    checked: requiredPaths.length,
    bindings: ["DB", "AST_STORAGE", "VECTORIZE_INDEX"],
  }),
);
