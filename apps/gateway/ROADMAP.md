# Roadmap

Direction for the SibylHub Gateway — not a delivery commitment, and no dates. The gateway code is derived from the AISIX AI Gateway (see [NOTICE](NOTICE)); upstream issue references in source comments are historical.

## Now

| Capability | What's planned | Surface |
| --- | --- | --- |
| Validation gates | Locked fmt/clippy/check/test wired through the monorepo bridge, with the e2e and MCP-conformance suites documented as prerequisite-dependent tasks. | Gateway |
| Documentation | Gateway pages in `apps/docs` covering role, commands, compatibility aliases, and evidence boundaries. | Docs |

## Next

| Capability | What's planned | Surface |
| --- | --- | --- |
| Container publication | Publish `ghcr.io/sibylhub/gateway` and replace local-build references. | Gateway |
| Control-plane decision | The dormant upstream managed-mode compatibility surface (etcd, heartbeat, telemetry, budget checks) is kept for wire compatibility; revisit whether to keep, remove, or replace it. | Gateway |
| Image layout | New `/etc/sibyl-gateway` / `/var/lib/sibyl-gateway` container paths baked into a SibylHub-owned image. | Gateway |

## Later

| Capability | What's planned | Surface |
| --- | --- | --- |
| Semantic response caching maturation | Embedding-similarity cache hardening beyond the inherited implementation. | Gateway |
| Control-plane integration | A first-party SibylHub control surface, if and when a design exists. Nothing is advertised until then. | Gateway |
| External secret management | Provider and caller credentials from external KMS/secret stores. | Gateway |

## Related

- [SibylHub Gateway README](README.md)
- Identifier inventory and approved naming: `openspec/changes/integrate-sibylhub-gateway/identifier-matrix.md`
