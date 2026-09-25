import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCandidateArtifact } from "@sibylhub/schemas/candidates";

const fixture = JSON.parse(
  await readFile(
    resolve(import.meta.dirname, "../fixtures/valid-candidate-ingestion.json"),
    "utf8",
  ),
);
const result = validateCandidateArtifact(fixture);
if (!result.valid) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log("packaged candidate consumer verified");
