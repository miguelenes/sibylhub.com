---
sidebar_position: 2
---

# Workspace boundaries

Turborepo caches deterministic build, lint, typecheck, and test outputs using committed lockfiles and declared inputs. Development servers, migrations, deployment, publication, coverage, and cleanup remain uncached because they have process or external-state effects.

`apps/web` owns Astro and Cloudflare Worker output. `apps/backoffice` owns Laravel, Filament, Composer, and the registry database. `apps/backend` owns the Axum API and its operational state. `apps/cli` owns the `sibyl` executable. `apps/gateway` owns the SibylHub Gateway, an independent Cargo workspace documented in [SibylHub Gateway](gateway). `apps/docs` owns the static Docusaurus build. `packages/schemas` owns JSON Schema and Zod validation, while `packages/typescript-config` owns shared compiler presets.

Run `pnpm install --frozen-lockfile`, then use `pnpm check:config`, `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format`, and `pnpm clean` from the workspace root.
