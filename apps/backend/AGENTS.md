# Backend guidance

The backend owns its operational state and reads a versioned registry export. It must not connect to Laravel tables. `GET /healthz`, `GET /v1/ecosystems`, `POST /v1/invariants/validate`, `POST /v1/invariants/check`, and `POST /v1/context/budget` are the local API contracts. The default bind is `0.0.0.0:8080`; override it with `SIBYL_BIND`. Use typed errors for request/configuration boundaries and keep tokens out of logs.

Run Cargo with `--locked`. The local API can return an explicitly documented empty ecosystem and compliant package-policy result when no registry source is configured. A configured snapshot or public export must match the declared schema version before it is served. Schema `2.0` uses the split index and language artifacts; schema `1.0` is available only through the explicit legacy configuration.
