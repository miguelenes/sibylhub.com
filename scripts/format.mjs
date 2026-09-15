import { spawnSync } from "node:child_process";
import process from "node:process";

const check = process.argv.includes("--check");
const prettierArgs = [
  check ? "--check" : "--write",
  "--plugin=prettier-plugin-astro",
  "**/*.{js,mjs,cjs,ts,tsx,astro,json,jsonc,md,mdx,yaml,yml}",
];
const prettier = spawnSync("pnpm", ["exec", "prettier", ...prettierArgs], {
  stdio: "inherit",
});
if (prettier.status !== 0) process.exit(prettier.status ?? 1);

const cargoArgs = ["fmt", "--all"];
if (check) cargoArgs.push("--", "--check");
const cargo = spawnSync("cargo", cargoArgs, { stdio: "inherit" });
if (cargo.status !== 0) process.exit(cargo.status ?? 1);

if (!check) {
  const pint = spawnSync(
    "sh",
    [
      "-c",
      "if [ -x apps/backoffice/vendor/bin/pint ]; then apps/backoffice/vendor/bin/pint; else exit 0; fi",
    ],
    { stdio: "inherit" },
  );
  if (pint.status !== 0) process.exit(pint.status ?? 1);
}
