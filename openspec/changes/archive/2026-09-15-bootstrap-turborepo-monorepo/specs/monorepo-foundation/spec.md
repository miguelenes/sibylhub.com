## Purpose

Provide one reproducible workspace contract for coordinating the JavaScript, PHP, and Rust applications without coupling their runtime dependencies or hiding their validation boundaries.

## ADDED Requirements

### Requirement: The repository exposes explicit application ownership

The workspace SHALL expose separate, discoverable application roots for `web`, `backoffice`, `backend`, `cli`, and `docs`, and each root SHALL have a documented runtime owner and local development command.

#### Scenario: An engineer discovers application boundaries
- **WHEN** the engineer follows the root workspace documentation
- **THEN** they can identify the owner, runtime, dependency manager, development command, and build output for each requested application without inspecting generated dependencies

### Requirement: The workspace provides consistent root task entry points

The workspace SHALL provide root commands for development, production build, linting, type checking, testing, coverage testing, and cleaning, and SHALL route each command to only the applications that implement the corresponding task.

#### Scenario: A root validation command is run
- **WHEN** an engineer runs the documented root validation command
- **THEN** the command executes the relevant application checks with a deterministic task order and reports the failing application and task without requiring manual directory changes

### Requirement: Task caching preserves correctness

The workspace SHALL cache only reproducible task outputs, SHALL include relevant source/configuration/toolchain inputs in task identity, SHALL run dependency builds before dependent builds, and SHALL not cache development servers or side-effecting deployment/database operations.

#### Scenario: An unchanged build is repeated
- **WHEN** the same source, configuration, lockfiles, and declared environment inputs are built again
- **THEN** Turborepo may restore the declared outputs from cache, while a source or relevant configuration change invalidates the affected task

#### Scenario: A development server is started
- **WHEN** an engineer runs the root development command
- **THEN** the long-running server tasks remain live and are never restored as completed cached work

### Requirement: Workspace setup is reproducible without secrets

The repository SHALL pin its package-manager and application toolchain expectations, commit the required lockfiles, document setup prerequisites, and provide non-secret environment examples without committing credentials or production resource identifiers.

#### Scenario: A new checkout is prepared
- **WHEN** an engineer follows the setup documentation on a machine with the documented runtimes
- **THEN** dependencies can be installed from committed manifests and lockfiles and the baseline validation commands can be run without access to production secrets

### Requirement: Agent guidance reflects the actual workspace

The repository SHALL contain root agent guidance and any necessary nested guidance that identify package boundaries, safe commands, validation gates, secrets handling, and the distinction between local build evidence and deployment/runtime evidence.

#### Scenario: An agent is asked to change one application
- **WHEN** the agent reads the closest applicable guidance file
- **THEN** it can determine the affected application, required focused checks, required root checks, and prohibited cross-application or secret-bearing actions
