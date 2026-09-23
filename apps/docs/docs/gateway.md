---
sidebar_position: 5
---

# SibylHub Gateway

The SibylHub Gateway (`apps/gateway`) is a Rust-native AI traffic gateway. It routes and governs SibylHub's AI-provider, MCP, and A2A traffic through one OpenAI-compatible API: routing and failover, rate and token limits, guardrails, caching, inbound API-key and OIDC/JWT authentication, and observability.

The code is derived from the open-source AISIX AI Gateway by API7 ([github.com/api7/aisix](https://github.com/api7/aisix)), Apache-2.0 — see `apps/gateway/LICENSE` and `apps/gateway/NOTICE`. It is not the AISIX/API7 product.

## Role and boundary

The gateway is a **separately operated application**. Other SibylHub applications send supported AI traffic _through_ it; the gateway does not host or serve the web app, backoffice, backend API, CLI, or documentation site. It also does not execute Rosie/FastMCP tools; that audited-tool boundary is documented separately.

## Workspace and commands

`apps/gateway` is an independent Cargo workspace: its own committed `Cargo.lock` and a pinned Rust toolchain (`rust-toolchain.toml`, installed on demand by rustup). It is never merged into the root Cargo workspace, and pnpm never resolves its Rust dependencies — the package manifest is a thin bridge that invokes Cargo so Turborepo can orchestrate it.

| Command                                                                               | Effect                                                                                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm dev:gateway`                                                                    | Runs the gateway with an untracked `config.local.yaml` (required; copy `config.example.yaml`) |
| `pnpm --filter gateway build`                                                         | Release build → `apps/gateway/target/release/sibyl-gateway`                                   |
| `pnpm --filter gateway lint` / `typecheck` / `format` / `test` / `test:cov` / `clean` | Locked Cargo clippy / check / fmt / test / clean through the bridge                           |

`pnpm dev` does not start the gateway.

## Compatibility aliases

| Surface                                                           | Current                                                              | Legacy behavior                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Environment prefix                                                | `SIBYL_GATEWAY_` (`__` nests keys)                                   | `AISIX_*` still applied, warned once at boot          |
| Config path env                                                   | `SIBYL_GATEWAY_CONFIG` / `SIBYL_GATEWAY_CONFIG_PATH`                 | `AISIX_CONFIG` / `AISIX_CONFIG_PATH` honored          |
| Inbound request-id header                                         | `x-sibylhub-request-id`                                              | `x-aisix-request-id` still accepted inbound           |
| Response/custom headers, metrics, executable, etcd prefix default | `x-sibylhub-*`, `sibyl_gateway_*`, `sibyl-gateway`, `/sibyl-gateway` | Renamed; see `apps/gateway/README.md` migration table |

## Validation and evidence

`pnpm --filter gateway test` runs locked unit/integration tests offline. The e2e suite (`pnpm --filter gateway test:e2e`) additionally requires local etcd (and optionally Redis) plus its own pnpm 11 Node harness; MCP conformance (`pnpm --filter gateway test:mcp-conformance`) requires Node ≥ 22. Both are uncached, explicitly invoked, and never run by root validation.

A passing local check proves the checked-out source only. It does not prove container publication (`ghcr.io/sibylhub/gateway` is planned, not published), a running deployment, provider authentication, live traffic behavior, or the dormant managed-mode compatibility surface connecting to any control plane. SibylHub operates no control plane for this gateway.
