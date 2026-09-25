# Releasing the SibylHub Gateway

`apps/gateway` is an independent Cargo workspace inside the monorepo. Releases
are driven by Git tags and the root GitHub workflows listed here. Local checks
are local evidence only: they do not prove image publication, registry state, or
live provider traffic.

## Tag convention

Gateway releases use the tag form `vX.Y.Z` (for example `v0.4.0`), optionally
with a prerelease suffix: `vX.Y.Z-rc.N`.

The monorepo has no shared release-tag scheme yet, so `vX.Y.Z` is
**Gateway-specific**. Before the monorepo adopts shared release tags, introduce
a namespaced scheme (for example `gateway/vX.Y.Z`) so that a tag for another
application cannot trigger a Gateway publication — and never reuse `vX.Y.Z`
for a non-Gateway release.

## What a version tag does

1. `.github/workflows/gateway-docker-image.yml` builds both architectures
   natively, assembles one multi-arch manifest list per registry, signs it
   keyless with cosign, and publishes the tag set. Release tags are also
   mirrored to Docker Hub; `dev` and `sha-` builds stay on GHCR.
2. The same workflow publishes the release Admin API OpenAPI
   (`openapi-<version>.json`, and `openapi-latest.json` for stable releases
   only) when the S3/CloudFront secrets are configured.
3. `.github/workflows/gateway-release-draft.yml` creates a draft GitHub
   Release from `apps/gateway/.github/release-notes-header.md` plus GitHub's
   generated "What's Changed" list. Drafts do not notify watchers, so nothing
   is announced until a maintainer publishes the release.

`.github/workflows/gateway-ci.yml` validates the Gateway on pushes to `main`
and pull requests. `main` requires the `e2e (vitest) + coverage` and
`coverage >= 90%` status contexts; the e2e and MCP conformance jobs provision
their own etcd/Redis/Node prerequisites. The Gateway e2e harness and MCP
conformance suite are never part of root validation — run them explicitly with
`pnpm --filter gateway test:e2e` and `pnpm --filter gateway test:mcp-conformance`.

## Image tag policy

| Trigger | Published tags |
| --- | --- |
| Push to `main` | `:dev` + `:sha-<shortsha>` |
| Stable tag `vX.Y.Z` | `:X.Y.Z` + `:latest` + `:sha-<shortsha>` |
| Prerelease tag `vX.Y.Z-rc.N` | `:X.Y.Z-rc.N` + `:sha-<shortsha>` (no `:latest`) |
| Pull request | Build only, nothing published |
| Manual dispatch | `:sha-<shortsha>` + optional `tag` input |

A version tag is published in full only — there is no `:X.Y` or `:X`
abbreviation. `:latest` and `:dev` are the only moving pointers, and a
prerelease tag must never move `:latest` or `openapi-latest.json` off the last
stable release.

## PGO policy

Profile-guided optimization runs only for a **stable** release tag (`vX.Y.Z`).
Pull requests, `main`, manual dispatches, and `-rc.N` candidates build in a
single compile. The QA'd `-rc.N` image is therefore not PGO'd while the released
image is; PGO changes code layout, never semantics.

Because the release tag is the first build to exercise the three-phase PGO
pipeline on that commit, pre-flight it on the release commit before tagging:

```bash
gh workflow run gateway-docker-image.yml --ref <release-commit-ref> -f pgo=true
```

A pull request that touches the Dockerfile, Cargo manifests/lockfile, toolchain
pin, or PGO training assets also exercises the PGO path automatically.

## Prerequisites and secrets

- `DOCKER_REGISTRY`, `DOCKER_USERNAME`, `DOCKER_PASSWORD` — Docker Hub mirror
  on release tags.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_REGION`,
  `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` — optional OpenAPI publishing; the
  workflow skips publishing with a notice when they are absent.
- Object-store cloud checks use `SIBYL_GATEWAY_E2E_OBJSTORE_*`,
  `SIBYL_GATEWAY_E2E_OIDC_AWS_ROLE_ARN`, and `SIBYL_GATEWAY_E2E_OBJSTORE_CLOUDID_*`
  secrets and run only from `.github/workflows/gateway-objstore-real-cloud.yml`
  and `.github/workflows/gateway-objstore-cloud-identity.yml` — manual dispatch,
  the monthly schedule, or a same-repository pull request labeled
  `objstore real cloud`. Fork pull requests never receive those credentials and
  cannot trigger publication.

## Release checklist

1. Confirm `main` is green, including the Gateway CI schema/OpenAPI drift checks.
2. Tag a release candidate (`vX.Y.Z-rc.N`) and QA the published image.
3. Pre-flight the release commit with `workflow_dispatch` and `pgo=true`.
4. Tag the stable release (`vX.Y.Z`); the image and draft release are created.
5. Curate the draft release notes and publish the release.
