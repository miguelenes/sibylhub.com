import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  adapter: cloudflare({
    remoteBindings: false,
  }),
  session: false,
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
  server: { port: 4321 },
});
