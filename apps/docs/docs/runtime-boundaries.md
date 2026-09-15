---
sidebar_position: 5
---

# Runtime and deployment boundaries

The web application uses Astro server output and Wrangler Worker preview/deploy commands. Documentation produces a static `build/` directory. The backoffice export writes a local R2-compatible tree before any separate publication step. The Rust API reads a validated versioned export, not Laravel tables. `sibyl sync` needs an explicit HTTPS endpoint and authorization.

No local build, test, or docs command creates Cloudflare resources, changes DNS, writes a production database, publishes a registry, or calls synchronization services.
