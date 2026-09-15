---
sidebar_position: 3
---

# Shared schemas

The optional Context7 retrieval boundary reads these versioned artifacts as documentation context; it does not become a runtime dependency of the applications and never fetches private or remote state during local builds. This keeps documentation retrieval reproducible and lets each consumer validate the same schema-version envelope.

The schema package defines four versioned artifacts: `ecosystem-1.0.json`, `agent-config-1.0.json`, `skills-1.0.json`, and `invariants-1.0.json`. The ecosystem fixture contains exactly 25 language identities with runtime, package-manager, lockfile, builder, invariant, documentation, and valid PURL relationships. TypeScript, PHP, Rust, and documentation workflows consume these generated JSON artifacts rather than defining a second registry vocabulary.

`.agent/config.json` is declarative metadata. `sibyl init` records runtime owners, safe read-only command names, manifest evidence, selected invariant IDs, and the controls `remoteMutationRequiresExplicitCommand` and `remoteEvidenceIsSeparate`. `sibyl check` parses this metadata and local manifests without resolving dependencies, running scripts, contacting the network, or mutating the project.

The backend invariant endpoint accepts `language_id`, `invariant_id`, and structured evidence (`runtime_id`, `lockfile_id`, `manifest_paths`, and an optional `package_manager_id`). It evaluates the registry-declared `declared-runtime-and-lockfile` rule. A legacy client-supplied `compliant` flag is rejected; malformed or unresolved requests are structured `400` responses, while evidence violations are structured `422` diagnostics.

Run `pnpm verify:contracts` after building schemas to check the four stable IDs, the complete fixture, generated package imports, and the shared valid documents offline.

AST skeletons preserve structure without copying private source. Socraticode records the questions and evidence used to resolve an invariant. Both remain data contracts and never execute embedded commands.
