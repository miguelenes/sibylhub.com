# SibylHub Gateway

The SibylHub Gateway is a Rust-native AI gateway that puts a single, OpenAI-compatible API in front of every LLM provider — OpenAI, Anthropic, Google Gemini, AWS Bedrock, Azure OpenAI, DeepSeek, and any OpenAI-compatible endpoint. It routes and governs SibylHub's AI, MCP, and A2A traffic: routing and failover, rate and token limits, guardrails, caching, inbound API-key and OIDC/JWT authentication, and observability ship in the box, with first-class SSE streaming.

> **Provenance.** This code is derived from the open-source AISIX AI Gateway by API7 ([github.com/api7/aisix](https://github.com/api7/aisix)), licensed Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). It is developed further as part of SibylHub and is not the AISIX/API7 product.

The gateway is a **separately operated application**. It routes AI traffic for the other SibylHub applications (web, backoffice, backend API, CLI, docs); it does not host or serve them.

## Monorepo integration

`apps/gateway` is an **independent Cargo workspace** (18 crates, committed `Cargo.lock`, Rust toolchain pinned in [`rust-toolchain.toml`](rust-toolchain.toml)). It is never merged into the repository's root Cargo workspace, and its Rust dependency graph is never resolved through pnpm. The pnpm package manifest here is a thin bridge that invokes Cargo so Turborepo can orchestrate it like every other app.

From the repository root:

| Command | What it does |
| --- | --- |
| `pnpm --filter gateway build` | Release build → `target/release/sibyl-gateway` |
| `pnpm --filter gateway lint` | `cargo clippy --workspace --all-targets -- -D warnings` |
| `pnpm --filter gateway typecheck` | `cargo check --workspace --all-targets` |
| `pnpm --filter gateway format` | `cargo fmt --all -- --check` |
| `pnpm --filter gateway test` / `test:cov` | `cargo test --workspace --locked` |
| `pnpm --filter gateway clean` | `cargo clean` for the server crate |
| `pnpm dev:gateway` | Runs the gateway with a local `config.local.yaml` (required, untracked — copy `config.example.yaml`) |

`pnpm dev` intentionally does **not** start the gateway: it needs that local configuration file. The prerequisite-dependent e2e and conformance suites are explicit, uncached tasks and are never part of root validation:

| Task | Prerequisites |
| --- | --- |
| `pnpm --filter gateway test:e2e` | etcd (`docker run --rm -p 2379:2379 quay.io/coreos/etcd:v3.5.15`), optionally Redis; installs its own pnpm 11 Node harness |
| `pnpm --filter gateway test:mcp-conformance` | Node ≥ 22, network for the pinned conformance suite |

## Quickstart (declarative, no control plane)

```yaml
# config.yaml
resources_file: /etc/sibyl-gateway/resources.yaml
proxy:
  addr: "0.0.0.0:3000"
admin:
  enabled: false          # a declarative gateway needs no admin listener
observability:
  metrics:
    prometheus:
      enabled: true
      addr: "0.0.0.0:9090"
```

Resources live in one `resources.yaml` (provider keys, models, caller API keys, guardrails, MCP servers, A2A agents, cache policies, observability exporters, rate-limit policies, OIDC providers), validated against the JSON Schemas in [`schemas/`](schemas/README.md) that the gateway itself uses at runtime. Edit the file and send `SIGHUP` to reload atomically; an invalid file is rejected whole. Validate offline with `sibyl-gateway validate --resources resources.yaml`. For a multi-replica cluster, point the gateway at etcd instead — `resources_file` and `etcd` are mutually exclusive.

Then call the gateway exactly like OpenAI:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $CALLER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"my-model","messages":[{"role":"user","content":"hello"}]}'
```

## Features

- **OpenAI-compatible proxy** (`:3000`) — `chat/completions`, `completions`, `responses`, `embeddings`, `rerank`, `images/{generations,edits}`, `audio/*`, `videos`, `files`, `batches`, `fine_tuning/jobs`, `realtime`, `GET /v1/models`, plus a root-level `/passthrough/:provider/*` escape hatch. Native SSE streaming, tool calling, JSON mode, multimodal input.
- **Anthropic Messages API** — `POST /v1/messages` (+ `count_tokens`) against any configured upstream, translated both ways.
- **Routing & failover** — six strategies (weighted round-robin, consistent-hash, failover, least-cost/latency/busy), priority tiers, retry budgets, cooldowns, tag-conditional targets.
- **Ensemble and semantic routing** — fan-out to a judged model panel; embedding-similarity dispatch to per-route targets.
- **Rate limiting & concurrency** — RPS/RPM/RPH/RPD + TPM/TPD + concurrency, AND-combined across caller keys, models, and policy scopes; per-process or shared via Redis.
- **Guardrails** — keyword/regex, PII detection and redaction, Presidio, Lakera, OpenAI Moderation, AWS Bedrock Guardrails, Azure AI Content Safety, Alibaba Cloud services, sandboxed custom scripts; block or monitor mode.
- **Caching** — exact-match response cache with TTL and scope matchers (memory/Redis), semantic cache on Redis 8+, automatic Anthropic prompt caching.
- **MCP gateway** — upstream MCP servers fronted at `/mcp` with gateway-held credentials, tool ACLs, and every Streamable HTTP revision through stateless `2026-07-28`.
- **A2A agent gateway** — agents fronted at `/a2a/:agent` over JSON-RPC 2.0 with rewritten agent cards.
- **Inbound auth** — SHA-256-hashed caller API keys with model allowlists and expiry, or OIDC/JWT bearers with JWKS caching.
- **Observability** — Prometheus `/metrics`, structured access logs, usage events, OTLP/GenAI span export, Datadog and Aliyun SLS exporters, object-storage telemetry.
- **Operational endpoints** — `/livez`, `/readyz`; `/status/config`, `/status/ready`, `/status/models` on the metrics listener; read-only admin surface with OpenAPI 3 and a playground on `:3001`.

## Configuration compatibility

| Surface | Current identifier | Legacy alias |
| --- | --- | --- |
| Environment prefix | `SIBYL_GATEWAY_` (`__` nests) | `AISIX_*` still applied, warned once at boot |
| `--config` env fallback | `SIBYL_GATEWAY_CONFIG` / `SIBYL_GATEWAY_CONFIG_PATH` | `AISIX_CONFIG` / `AISIX_CONFIG_PATH` |
| Inbound request-id header | `x-sibylhub-request-id` | `x-aisix-request-id` still accepted inbound |
| Response/custom headers | `x-sibylhub-*` | renamed (no alias) |
| Prometheus series | `sibyl_gateway_*` | renamed (no alias) |
| etcd prefix default | `/sibyl-gateway` | set `etcd.prefix` for pre-existing stores |
| Filesystem paths | `/etc/sibyl-gateway`, `/var/lib/sibyl-gateway` | moved; update mounts |

## Development

Prerequisites: the Rust toolchain pinned in [`rust-toolchain.toml`](rust-toolchain.toml) (rustup installs it on demand). Docker is only needed for the tests that exercise etcd, Redis, or provider emulators.

```bash
cargo check --workspace --locked
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked

# Run locally against a resources.yaml (no etcd needed)
cargo run -p sibyl-gateway-server --bin sibyl-gateway --locked -- --config config.local.yaml

# Regenerate the resource JSON Schemas after model doc-comment changes
cargo run -p sibyl-gateway-core --bin dump-schema
```

## Managed mode (compatibility surface)

The gateway retains an etcd/managed-mode wire contract for an **external upstream control plane** (heartbeats, telemetry, budget checks over mTLS). SibylHub does not operate such a control plane, the surface is dormant by default (`managed.enabled` is opt-in), and SibylHub publishes no control plane of its own. Do not point the surface at anything untrusted.

## License

[Apache-2.0](LICENSE), with attribution per [NOTICE](NOTICE). Internal engineering guidance lives in [AGENTS.md](AGENTS.md).
