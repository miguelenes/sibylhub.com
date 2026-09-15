import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(packageRoot, "src/styles/globals.css");
const destination = resolve(packageRoot, "dist/styles/globals.css");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
