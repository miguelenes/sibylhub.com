# Backend guidance

The backend owns its operational state and reads a versioned registry export. It must not connect to Laravel tables. `GET /healthz`, `GET /v1/ecosystems`, and `POST /v1/invariants/validate` are the local API contracts. Use typed errors for request/configuration boundaries and keep tokens out of logs.

Run Cargo with `--locked`. The local API can return an explicitly documented empty ecosystem result when no snapshot path is configured. A configured snapshot must match the declared schema version before it is served.
