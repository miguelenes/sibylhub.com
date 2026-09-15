---
sidebar_position: 3
---

# Shared schemas

The optional Context7 retrieval boundary reads these versioned artifacts as documentation context; it does not become a runtime dependency of the applications and never fetches private or remote state during local builds. This keeps documentation retrieval reproducible and lets each consumer validate the same schema-version envelope.

The schema package defines the legacy versioned artifacts `ecosystem-1.0.json`, `agent-config-1.0.json`, `skills-1.0.json`, and `invariants-1.0.json`, plus the current schema `2.0` split registry export. The `2.0` export contains `data/v1/index.json` and one `data/v1/languages/{slug}.json` artifact per language. Both forms contain exactly 25 stable language identities with validated runtime, package-manager, lockfile, builder, invariant, documentation, and PURL relationships. TypeScript, PHP, Rust, and documentation workflows consume these generated JSON artifacts rather than defining a second registry vocabulary.

`.agent/config.json` is declarative metadata. `sibyl init` records runtime owners, safe read-only command names, manifest evidence, selected invariant IDs, and the controls `remoteMutationRequiresExplicitCommand` and `remoteEvidenceIsSeparate`. `sibyl check` parses this metadata and local manifests without resolving dependencies, running scripts, contacting the network, or mutating the project.

The backend invariant endpoint accepts `language_id`, `invariant_id`, and structured evidence (`runtime_id`, `lockfile_id`, `manifest_paths`, and an optional `package_manager_id`). It evaluates the registry-declared `declared-runtime-and-lockfile` rule. A legacy client-supplied `compliant` flag is rejected; malformed or unresolved requests are structured `400` responses, while evidence violations are structured `422` diagnostics.

`POST /v1/invariants/check` is the additive package-policy endpoint. It accepts `ecosystem`, `runtime`, and a dependency version map, then returns `compliant` plus deterministic violations with the banned package, severity, approved replacement, and reason. `POST /v1/context/budget` accepts `{ "context_ceiling_tokens": 128000 }` and returns exact integer partitions for Rules, Memories, AST Skeletons, Active Files, and Tools. Both endpoints reject malformed, unresolved, or unknown-field requests with structured `400` responses.

The backend defaults to `0.0.0.0:8080`, emits JSON logs for `SIBYL_ENV=production`, and emits ANSI-capable development logs otherwise. Set `SIBYL_REGISTRY_SNAPSHOT` for a local export or `SIBYL_REGISTRY_URL` for an HTTPS public export; local snapshots take precedence. With neither configured, the backend serves an explicitly documented empty ecosystem and no-policy result. Invalid configured exports prevent startup.

Run `pnpm verify:contracts` after building schemas to check the four stable IDs, the complete fixture, generated package imports, and the shared valid documents offline.

AST skeletons preserve structure without copying private source. Socraticode records the questions and evidence used to resolve an invariant. Both remain data contracts and never execute embedded commands.
