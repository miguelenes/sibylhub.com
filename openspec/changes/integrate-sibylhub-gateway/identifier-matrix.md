# Identifier inventory & migration matrix — SibylHub Gateway

Tasks 1.1 and 1.2 of `integrate-sibylhub-gateway`. Produced before any renaming; every externally consumed identifier below needs a task-1.3 approval or an explicit preserve decision. Proposed values are **proposals**, not decisions.

## 1. Method & evidence commands

Searched `apps/gateway/` with ripgrep, hidden files included, `.git` excluded, gitignore respected (no `target/` build artifacts exist in the tree). Occurrences of `aisix`/`AISIX`/`api7`/`moonming` **outside** `apps/gateway/` exist only in this change's own planning artifacts.

```sh
# totals (hidden-aware)
rg -i -l --hidden -g '!.git' '<pattern>' apps/gateway | wc -l
rg -i -o --hidden -g '!.git' '<pattern>' apps/gateway | wc -l
# area breakdown
rg -i -c --hidden -g '!.git' 'aisix' apps/gateway | awk -F: '{n=split($1,p,"/"); a[p[3]]+=$NF} END {for (k in a) print a[k], k}' | sort -rn
# distinct forms
rg -o --hidden -g '!.git' 'AISIX_[A-Z0-9_]+' apps/gateway --no-filename | sort -u
rg -o --hidden -g '!.git' '"(x-)?aisix-[a-z-]+"' apps/gateway --no-filename | sort -u
rg -o --hidden -g '!.git' 'aisix_[a-z0-9_]+' apps/gateway --no-filename | sort -u
# license evidence
find . -iname 'LICENSE*' -not -path '*/node_modules/*' -not -path './.git/*'   # → empty
```

## 2. Inventory summary

| Pattern | Files | Matches | Notes |
|---|---|---|---|
| `aisix` (any case) | 528 | 8,317 | crates 5,971 · tests/e2e 1,209 · schemas 123 · `.github` 119 · Cargo.lock 84 · bench 65 · Dockerfile 54 · README 53 · config.example 47 · config.managed 39 · Cargo.toml 31 · CLAUDE.md 31 · docker/ 19 · glama/ 15 · ROADMAP 6 · tools 3 · assets 3 · scripts 1 · .gitignore 1 |
| `api7` (any case) | 70 | 164 | mostly URLs, org refs, issue citations |
| `moonming` | 2 | 3 | Cargo.toml repository/authors, glama.json maintainers |
| `AI Gateway` (prose) | 11 | 21 | README, ROADMAP, Dockerfile, CLAUDE.md, schemas/README, main.rs, dump-openapi.rs, e2e package.json, architecture SVG |

## 3. License & provenance verification (task 1.2 outcome)

**Evidence:**

- Local tree: `find` across the whole repository finds **no `LICENSE` file anywhere**. The gateway's workspace `Cargo.toml` declares `license = "Apache-2.0"`, and the README badge links to a missing local `LICENSE`.
- Upstream: the public repository **`https://github.com/api7/aisix`** (API7) is GitHub-labeled **Apache-2.0** with a root `LICENSE` file. Its tree structure and README match our `apps/gateway` copy — this tree is a vendored copy of that project. `Cargo.toml`'s `repository = "https://github.com/moonming/ai-gateway"` / `authors = ["moonming"]` point at the author's own repo (Ming Wen, API7).
- Upstream `LICENSE` fetched and confirmed to be the **verbatim, unmodified Apache License 2.0 text**. Upstream ships **no `NOTICE` file** (§4(d) therefore does not apply).

**Outcome — rebranding is PERMITTED** under Apache-2.0 subject to these obligations, which become implementation tasks:

1. Vendor the Apache-2.0 license text as `apps/gateway/LICENSE`.
2. Add an attribution/provenance notice (e.g. `apps/gateway/NOTICE` or a README section): *derived from the AISIX AI Gateway by API7, https://github.com/api7/aisix, Apache-2.0* — satisfies §4(c) attribution retention and §6's "describing the origin" allowance.
3. Do **not** present the derivative as the AISIX/API7 product (§6 grants no trademark rights); removing their branding is exactly what the license contemplates for derivative works.
4. Cargo `repository`/`authors` metadata moves to SibylHub values; upstream attribution lives in the notice, not the package metadata.

Distribution-facing branding changes (README, container labels, registry refs) may proceed only after obligations 1–2 land. Note: upstream also has `CONTRIBUTING.md`, `RELEASING.md`, `AGENTS.md`, `.dockerignore`, `.editorconfig` that our copy lacks — none are license-bearing.

## 4. Classification matrix

Classifications follow design.md: **FIRST-PARTY** (rebrand, no compat), **EXTERNAL** (gateway-owned, externally consumed → rename with alias/migration), **INTERNAL** (rename opportunistically, not externally consumed), **PRESERVE** (third-party/protocol/upstream), **CONTROL-PLANE** (upstream wire contract, pending decision), **PROVENANCE** (license/attribution).

### 4.1 First-party identity → rebrand to "SibylHub Gateway"

| Current | Proposed | Affected |
|---|---|---|
| "AISIX AI Gateway" / "AISIX" prose | "SibylHub Gateway" | README (53), ROADMAP (6), Dockerfile comments, schemas/README (15), config examples, `main.rs` doc-comment/about, `dump-openapi.rs`, e2e `package.json` description, SVG alt text |
| OpenAPI `info.title: "AISIX Admin API"` + description | "SibylHub Gateway Admin API" | `crates/aisix-admin/src/openapi.rs` (regenerate `/admin/openapi.json`) |
| `observability.service_name` default `"aisix"` / `"aisix-e2e"` | `"sibyl-gateway"` | config.example/managed, `crates/aisix-server`, e2e harness |
| README/ROADMAP marketing: badges, "Start free", docs/quickstart links, Discord, demo, "Why AISIX", Cloud comparison, screenshots | Remove or replace with SibylHub-neutral content + placeholder status | README, ROADMAP, assets/ |
| Brand assets: `assets/console-*.png` (AISIX Cloud UI), `assets/aisix-architecture.svg` | Remove or mark as upstream-archival; no SibylHub product evidence | assets/, README |
| `.github/workflows/*` branding (job names, image refs, `AISIX_*` secrets/vars) | Rebrand to SibylHub names; workflows referencing upstream registries/orgs are disabled or repointed in task 3.x | `.github/` (119) |
| `glama/` dir + `glama.json` (Glama registry listing for `api7/aisix`, maintainer `moonming`) | **Proposed: remove** — upstream listing infrastructure, not SibylHub distribution | glama/ (15), glama.json |

### 4.2 Gateway-owned external identifiers → rename with alias or documented migration

| Current | Proposed | Compatibility | Affected |
|---|---|---|---|
| Executable `aisix` ([[bin]] name, `aisix validate`, `aisix export`) | `sibyl-gateway` | New name only; document migration (no known existing callers inside SibylHub) | `aisix-server/Cargo.toml`, Dockerfile (`/usr/local/bin/aisix`), `docker/entrypoint.sh`, README, glama scripts, e2e `AISIX_BIN` default |
| `Server` response header `AISIX/<version>` (RFC 9110 product token) | `SibylHub-Gateway/<version>` | Breaking (clients keying on it); none known | `crates/aisix-proxy/src/lib.rs:121` (`SERVER_HEADER_VALUE`) + header tests |
| Inbound header `x-aisix-request-id` (default accept list, 187 refs) | `x-sibylhub-request-id` | **Accept both** inbound (compat alias), emit new | `aisix-core` config defaults (`request_id.accept_headers`), `aisix-proxy`, e2e |
| Response/custom headers: `x-aisix-cache` (56), `x-aisix-api-key` (14), `x-aisix-routing-key` (12), `x-aisix-call-id` (10), `x-aisix-routing-tags` (8), `x-aisix-user`, `x-aisix-route`, `x-aisix-served-by`, `x-aisix-model`, `x-aisix-cache-similarity`, `x-aisix-cache-layer`, `x-aisix-usage-batch-id`, `x-aisix-usage-batch-dedup` | `x-sibylhub-*` equivalents | Breaking; migration table in docs | `aisix-core` header templates/forwarded headers, `aisix-proxy`, `aisix-obs`, schema descriptions, e2e |
| Env override prefix `AISIX_` (~35 vars: `AISIX_CONFIG`, `AISIX_CONFIG_PATH`, `AISIX_PROXY__*`, `AISIX_MANAGED__*`, `AISIX_OBSERVABILITY__*`, `AISIX_RATELIMIT__*`, `AISIX_KEY`/`AISIX_ADMIN_KEY`, `AISIX_ETCD_PASSWORD`, `AISIX_BEDROCK_ENDPOINT_URL`, `AISIX_BUILD_VERSION`/`_SHA`) | `SIBYL_GATEWAY_` (explicit) or `SIBYL_GW_` (compact) — decision 1.3-C | **Read both**, warn once per legacy var at boot (config loader is the single chokepoint) | `aisix-core/src/config.rs`, configs, Dockerfile ARGs/ENV, workflows, docs |
| Prometheus metrics `aisix_*` (~50 families: `aisix_requests_total`, `aisix_proxy_requests_total`, `aisix_llm_*`, `aisix_request_ttft_seconds`, `aisix_request_e2e_latency_seconds`, `aisix_guardrail_*`, `aisix_config_*`, `aisix_usage_*`, `aisix_deployment_*`, `aisix_auth_decisions_total`, `aisix_ratelimit_remaining_*`, `aisix_redis_failures_total`, `aisix_log_lines_dropped_total`, `aisix_budget_details_present`, `aisix_llm_spend_micro_usd_total`) | `sibyl_gateway_*` | Breaking (dashboards); proposed hard rename, no dual emission (pre-GA, no existing SibylHub dashboards) | `aisix-obs` (554 refs), `aisix-proxy`, schema/config label docs, e2e `/metrics` assertions |
| etcd stored-data prefix default `/aisix` (test prefix `/aisix-e2e-`) | `/sibyl-gateway` | Prefix is operator config; existing stores migrate by explicit `etcd.prefix` (no silent stored-data alias) | `aisix-core` defaults, config.example/managed, e2e harness |
| Container/filesystem paths `/etc/aisix` (61 refs), `/var/lib/aisix` (16), `/usr/local/share/aisix` (5) | `/etc/sibyl-gateway`, `/var/lib/sibyl-gateway`, `/usr/local/share/sibyl-gateway` | Image mount contract; documented in README | Dockerfile, `docker/entrypoint.sh`, `aisix-core/src/config.rs` defaults, configs, README |
| Container image refs `ghcr.io/api7/aisix` (4), `docker.io/api7/aisix` (README) | `ghcr.io/sibylhub/gateway` (pending org confirmation — decision 1.3-H); until published, docs reference local builds | Distribution target change | README, `.github/workflows/release-draft.yml`, `glama/extract-aisix.sh` |
| MCP registry label `io.modelcontextprotocol.server.name="io.github.api7/aisix"` | Drop (not listing yet) or `io.github.sibylhub/gateway` — decision 1.3-I | Registry identity | Dockerfile LABEL |
| Cargo metadata `repository = "github.com/moonming/ai-gateway"`, `authors = ["moonming"]` | SibylHub repository + authors; upstream attribution moves to the NOTICE (§3) | Metadata only | workspace `Cargo.toml`, `glama.json` (removed with glama/) |

### 4.3 Internal identifiers (not externally consumed) → rename opportunistically

| Current | Proposed | Affected |
|---|---|---|
| 18 crates `aisix-*` + lib names `aisix_*` (`aisix_core` 1,010, `aisix_gateway` 635, `aisix_obs` 268, `aisix_guardrails` 238, providers, proxy, admin, mcp, a2a, cache, redis, ratelimit, etcd) | `sibyl-gateway-*` / `sibyl_gateway_*` — scope decision 1.3-B (full vs server-only vs defer) | All `crates/*/Cargo.toml`, all imports, workspace members, `Cargo.lock` (regenerate) |
| Types `AisixSnapshot` (619), `AisixPath` (32), `AisixBedrockDefaultHeaders` (1) | `GatewaySnapshot`, `GatewayPath`, … (drop brand prefix) — follows 1.3-B | `aisix-core`, consumers |
| Test harness package `aisix-e2e`; tool `aisix-mcp-conformance-harness`; test fixture strings (`aisix-test-ca`, tmpdir prefixes, etcd test prefixes) | `sibylhub-gateway-e2e`, `sibylhub-gateway-mcp-conformance`, neutral fixtures | `tests/e2e/`, `tools/mcp-conformance/`, test sources |
| `bench/` scripts and identifiers (onthebench 47, pgo-training 9, metrics-scale 9) | Follow binary/crate renames | `bench/` |
| Heartbeat `dp_version` field name, `SIBYL`-less internals | Keep `dp_version` (wire field of the control-plane contract — see 4.5) | — |

### 4.4 Preserve — third-party, protocol, provider, upstream identity

- Provider/adapter names: `openai`, `anthropic`, `bedrock`, `vertex`, `azure-openai`, DeepSeek, Groq, Mistral, Together, Fireworks, Perplexity, vLLM, Ollama, Cohere, Jina, Lakera, Presidio, Datadog, Aliyun SLS, Langfuse, Honeycomb, Grafana, Entra ID, Okta.
- Protocols/standards: OpenAI-compatible API, Anthropic Messages, MCP (+ protocol dates), A2A, OIDC/JWT/JWKS, SSE, JSON-RPC 2.0, SigV4, Prometheus/OTLP.
- Upstream project references: `github.com/api7/lua-resty-expr`, APISIX/nginx/kong comparisons (e.g. `aisix-proxy/src/lib.rs` Server-header comment), `github.com/api7/aisix` in provenance/attribution contexts (README attribution, NOTICE).
- `x-api-key` (Anthropic) and every non-`aisix` wire header.

### 4.5 Control-plane integration (managed mode) — decision 1.3-G

| Surface | Detail |
|---|---|
| Wire contract | `managed.enabled`, `AISIX_MANAGED__CP_BASE_URL/_ETCD_ENDPOINT/_CERT_PEM/_KEY_PEM/_CA_PEM`, `/dp/heartbeat`, `/dp/telemetry`, `/dp/budget_check`, `dp_id`/`env_id`, `dpfloor`, `config.managed.yaml`, `aisix-dp/<version>` User-Agent (heartbeat.rs:601, telemetry.rs:713) |
| Product prose | "AISIX Cloud" in README/ROADMAP/CLAUDE.md; `api7/AISIX-Cloud#NNN` issue citations |
| Note | `AISIX-Cloud` appears 1,331×, overwhelmingly as **historical issue citations in code comments** — classified PROVENANCE (upstream tracker remains public and useful). Not renamed wholesale. |
| Options | (1) **Recommended:** keep the wire contract untouched as a dormant, explicitly labeled *upstream AISIX Cloud compatibility* surface (default off — it already requires explicit `managed.enabled: true`), relabel config comments/docs, strip Cloud marketing from first-party docs; `aisix-dp` UA keeps its exact value while the surface exists. (2) Remove/disable the managed-mode code path. (3) Defer entirely. |

### 4.6 Provenance / license (preserve, never claim authorship)

| Item | Disposition |
|---|---|
| Apache-2.0 declaration + missing LICENSE | Vendor upstream LICENSE text (verbatim) as `apps/gateway/LICENSE`; see §3 |
| Attribution to API7 / AISIX AI Gateway / "original creators of Apache APISIX" | Keep as accurate origin statement in NOTICE/README attribution section; never as current product identity |
| `api7/AISIX-Cloud#NNN` historical issue citations in comments | Preserve (upstream tracker is public and load-bearing for context) |
| `docs.api7.ai` links on first-party surfaces (19) | Remove/replace on README/configs (not SibylHub docs); may remain in preserved historical citations |
| `CONTRIBUTING.md`, `RELEASING.md`, upstream `AGENTS.md` | Absent locally; not license-bearing; SibylHub authors its own guidance (task 2.4) |
| `CLAUDE.md` (31 `aisix`, 8 `api7`) | Upstream internal dev policy, not product surface. **Proposed:** leave verbatim for now (historical context), revisit after integration; SibylHub's own nested `AGENTS.md` is authored fresh in task 2.4 — decision 1.3-J |
| `.gitignore` (1 `aisix` match) | Inspect during task 3.2; likely a local-config ignore pattern |

## 5. Decisions (task 1.3) — **APPROVED 2026-09-23 (all recommendations)**

- **A. Binary name** → **APPROVED: `sibyl-gateway`**.
- **B. Crate/type rename scope** → **APPROVED: full rename.** 18 crates `aisix-*` → `sibyl-gateway-*` (lib names `sibyl_gateway_*`); types drop the brand prefix (`AisixSnapshot`→`GatewaySnapshot`, `AisixPath`→`GatewayPath`, `AisixBedrockDefaultHeaders`→`GatewayBedrockDefaultHeaders`). One non-mechanical exception: the hub/bridge crate `aisix-gateway` → `sibyl-gateway-hub` (lib `sibyl_gateway_hub`) to avoid a `gateway-gateway` double.
- **C. Env prefix** → **APPROVED: `SIBYL_GATEWAY_`**, legacy `AISIX_*` read with a once-per-var boot warning (config loader is the alias chokepoint). Test-harness env (`AISIX_BIN`, `AISIX_E2E_*`) renames with it; the e2e harness strip covers both prefixes.
- **D. Headers** → **APPROVED: emit `x-sibylhub-*`**; inbound `x-aisix-request-id` remains accepted (default accept list carries both). All other `x-aisix-*` response headers hard-rename; migration table documented.
- **E. Metrics** → **APPROVED: hard rename to `sibyl_gateway_*`, no dual emission.**
- **F. etcd prefix** → **APPROVED: new default `/sibyl-gateway`**; existing stores migrate via explicit `etcd.prefix` (no stored-data alias). Filesystem paths: `/etc/sibyl-gateway`, `/var/lib/sibyl-gateway`, `/usr/local/share/sibyl-gateway`.
- **G. Control plane** → **APPROVED: keep the managed-mode wire contract untouched** as a dormant, explicitly labeled *upstream AISIX Cloud compatibility* surface (default off), relabel config comments/docs, strip Cloud marketing from first-party surfaces; `aisix-dp` UA keeps its exact value while the surface exists.
- **H. Image registry** → **APPROVED: `ghcr.io/sibylhub/gateway`** as the intended target; docs reference local builds until published.
- **I. Glama artifacts** → **APPROVED: remove `glama/`, `glama.json`, and the MCP registry label.**
- **J. `CLAUDE.md`** → **APPROVED: leave verbatim for now**, revisit after integration; SibylHub authors its own nested `AGENTS.md` (task 2.4).

Also approved with A: `Server` header value `SibylHub-Gateway/<version>`; `observability.service_name` default `sibyl-gateway`.
