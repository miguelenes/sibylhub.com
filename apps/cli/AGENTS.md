# CLI guidance

`sibyl init` and `sibyl check` inspect manifests without executing project code. Initialization refuses to overwrite existing governance metadata unless `--force` is explicit. `sibyl sync` requires an HTTPS endpoint, an authorization value in the environment, and a payload path. It is the only CLI command that can contact a remote service.
