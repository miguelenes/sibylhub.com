# Spec Delta

## MODIFIED Requirements

### Requirement: Rust quality gates are reproducible offline

The Rust backend and CLI SHALL remain members of the top-level Cargo workspace, and the SibylHub Gateway SHALL remain an independently runnable Cargo workspace under `apps/gateway` with its own committed lockfile and pinned toolchain. The repository SHALL expose documented format, Clippy, build, test, and supported coverage commands for each Rust application through package and root orchestration tasks. Required local checks SHALL use locked dependencies and SHALL NOT deploy, publish, contact production services, or require provider credentials. Tests requiring local infrastructure SHALL be explicitly identified and separated from checks that run without those services.

#### Scenario: Rust validation runs offline
- **WHEN** an engineer runs the documented locked Rust validation commands without provider credentials
- **THEN** formatting, linting, compilation, and baseline tests validate the backend, CLI, and gateway, while any explicitly external or local-service-dependent test is separately identified

#### Scenario: Rust quality validation runs without provider credentials
- **WHEN** an engineer runs the documented locked Rust checks without provider credentials or production connectivity
- **THEN** formatting, linting, compilation, and baseline tests validate the backend, CLI, and gateway without remote mutation

#### Scenario: Gateway tools are run through the monorepo
- **WHEN** an engineer runs a gateway format, lint, build, test, or supported coverage task through its package or the root task graph
- **THEN** the task executes against the gateway's own Cargo workspace and lockfile and reports its package/task result

#### Scenario: A gateway check needs a local service
- **WHEN** a gateway test requires etcd, Redis, or a provider emulator
- **THEN** the requirement is surfaced as a local-service prerequisite and the test does not silently contact a production service or require provider credentials
