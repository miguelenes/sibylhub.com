import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  sourcemap: true,
  dts: false,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["@sibylhub/schemas"],
});
