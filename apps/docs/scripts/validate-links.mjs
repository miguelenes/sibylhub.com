import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../docs");
const files = (await readdir(root)).filter((file) => file.endsWith(".md"));
const bad = [];
for (const file of files) {
  const content = await readFile(join(root, file), "utf8");
  if (content.includes("/docs/missing")) bad.push(file);
}
if (bad.length) {
  console.error(`broken links: ${bad.join(", ")}`);
  process.exit(1);
}
console.log(`validated ${files.length} documentation files`);
