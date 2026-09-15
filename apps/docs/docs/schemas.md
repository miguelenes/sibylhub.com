---
sidebar_position: 3
---

# Shared schemas

The optional Context7 retrieval boundary reads these versioned artifacts as documentation context; it does not become a runtime dependency of the applications and never fetches private or remote state during local builds. This keeps documentation retrieval reproducible and lets each consumer validate the same schema-version envelope.

The schema package defines the versioned ecosystem document, PURLs, `.agent/config.json`, `.agent/skills.json`, and stack invariants. The ecosystem fixture contains 25 language identities. TypeScript, PHP, Rust, and documentation workflows consume the same JSON artifacts rather than defining a second registry vocabulary.

AST skeletons preserve structure without copying private source. Socraticode records the questions and evidence used to resolve an invariant. Both remain data contracts and never execute embedded commands.
