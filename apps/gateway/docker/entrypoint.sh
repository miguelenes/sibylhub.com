#!/bin/sh
# Container entrypoint for sibyl-gateway.
#
# Picks the config file based on SIBYL_GATEWAY_CONFIG_PATH (default
# /etc/sibyl-gateway/config.yaml). Two intended modes:
#
#   Standalone — operator mounts their own config:
#       docker run -v ./config.yaml:/etc/sibyl-gateway/config.yaml ghcr.io/sibylhub/gateway:dev
#
#   Managed (connected to AISIX Cloud) — use the baked-in template + env vars:
#       docker run \
#         -e SIBYL_GATEWAY_CONFIG_PATH=/etc/sibyl-gateway/config.managed.yaml \
#         -e SIBYL_GATEWAY_MANAGED__CP_BASE_URL \
#         -e SIBYL_GATEWAY_MANAGED__CP_ETCD_ENDPOINT \
#         -e SIBYL_GATEWAY_MANAGED__CP_CERT_PEM \
#         -e SIBYL_GATEWAY_MANAGED__CP_KEY_PEM \
#         -e SIBYL_GATEWAY_MANAGED__CP_CA_PEM \
#         -v sibyl-gateway-mtls:/var/lib/sibyl-gateway \
#         ghcr.io/sibylhub/gateway:dev
# The volume preserves the materialized mTLS bundle and gateway identity across
# container restarts.
#
# The Rust binary's `Config::load_from_path` already layers
# `SIBYL_GATEWAY_<UPPER>__<UPPER>` env vars on top of the YAML, so any field
# is reachable without re-templating the file.

set -eu

CONFIG_PATH="${SIBYL_GATEWAY_CONFIG_PATH:-/etc/sibyl-gateway/config.yaml}"

if [ ! -f "$CONFIG_PATH" ]; then
    echo "sibyl-gateway-entrypoint: config file not found at $CONFIG_PATH" >&2
    echo "sibyl-gateway-entrypoint: mount one at /etc/sibyl-gateway/config.yaml or set" >&2
    echo "sibyl-gateway-entrypoint: SIBYL_GATEWAY_CONFIG_PATH=/etc/sibyl-gateway/config.managed.yaml" >&2
    exit 64
fi

exec /usr/local/bin/sibyl-gateway --config "$CONFIG_PATH"
