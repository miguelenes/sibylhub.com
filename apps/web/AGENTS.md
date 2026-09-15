# Web application guidance

Astro owns server-rendered pages and the Cloudflare Worker build. React belongs in focused islands that need browser interaction. Tailwind v4 uses CSS-first `@import \"tailwindcss\"` and the Vite plugin. HeroUI v3 components must not use a provider or v2 API.

Run `pnpm validate`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm preview` as the local web checks. `pnpm deploy` is a guarded placeholder for a separately authorized Wrangler operation. Do not use Pages deployment commands for this server-rendered application.

The bindings `DB`, `AST_STORAGE`, and `VECTORIZE_INDEX` are optional for the baseline route. Keep local doubles deterministic and never add credentials or remote identifiers to `wrangler.toml`.
