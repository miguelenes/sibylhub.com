import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/tailwind-preset.ts"],
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  sourcemap: true,
  dts: false,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["@radix-ui/react-progress", "lucide-react", "react", "react-dom"],
});
