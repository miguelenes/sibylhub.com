# SibylHub platform guidance

This repository is a mixed-runtime monorepo. Keep JavaScript and TypeScript dependencies in pnpm manifests, PHP dependencies in `apps/backoffice/composer.json`, and Rust dependencies in the root Cargo workspace. Do not copy one runtime's lockfile or dependency graph into another runtime.

Use `pnpm check:config` before package work. The finish gates are `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:cov`, `pnpm format`, and `pnpm build`. Package-specific checks live in the nearest package manifest.

Prettier owns TypeScript, TSX, Astro, JSON, YAML, and Markdown. Pint owns PHP. Cargo owns Rust. Do not run a broad Prettier glob over PHP or Rust.

Local builds, tests, and configuration checks do not prove Cloudflare deployment, database convergence, remote registry publication, or synchronization. Those actions require their explicit package command and a separately recorded readback. Never commit credentials, private keys, live identifiers, or real environment values.

Read the nearest nested `AGENTS.md` before changing an application. Keep changes inside the owning package unless the contract or root task graph requires a coordinated edit.
