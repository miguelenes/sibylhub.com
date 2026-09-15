import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const config = await readFile(
  resolve(import.meta.dirname, "../wrangler.toml"),
  "utf8",
);
const required = [
  'binding = "DB"',
  'binding = "AST_STORAGE"',
  'binding = "VECTORIZE_INDEX"',
  'main = "./dist/_worker.js/index.js"',
];
const missing = required.filter((entry) => !config.includes(entry));
const hasFakeRemoteTarget = /account_id\s*=|database_id\s*=\s*"(?!local)/.test(
  config,
);
if (missing.length || hasFakeRemoteTarget) {
  console.error(
    JSON.stringify({
      code: "invalid_worker_config",
      missing,
      hasFakeRemoteTarget,
    }),
  );
  process.exit(1);
}
console.log(
  JSON.stringify({
    status: "ok",
    mode: "local-worker",
    bindings: ["DB", "AST_STORAGE", "VECTORIZE_INDEX", "AI"],
    optionalBindings: ["AI"],
  }),
);
