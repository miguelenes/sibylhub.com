## Purpose

Provide an isolated Laravel backoffice application with a Filament 5 panel foundation, safe local configuration, and PHP-native validation commands without introducing product-specific domain administration yet.

## ADDED Requirements

### Requirement: The backoffice boots as a Laravel application

The backoffice SHALL be created through the Laravel application workflow, SHALL expose documented local setup and development commands, and SHALL boot successfully with local example configuration and no production credentials.

#### Scenario: A fresh local backoffice is started
- **WHEN** an engineer follows the documented setup sequence with the supported PHP and Composer versions
- **THEN** Laravel starts in local mode and reports configuration or dependency failures clearly if a prerequisite is missing

### Requirement: The backoffice provides a Filament 5 panel foundation

The backoffice SHALL install and configure Filament 5, SHALL expose a reachable baseline panel route through Laravel's documented panel mechanism, and SHALL keep panel configuration within the backoffice application boundary.

#### Scenario: The baseline panel route is inspected
- **WHEN** the local backoffice is running and the panel route is requested
- **THEN** the application returns the configured Filament panel shell or an explicit authentication response, rather than a missing-route or framework bootstrap error

### Requirement: Backoffice configuration is safe by default

The backoffice SHALL use environment-driven configuration, SHALL provide example values that contain no secrets, SHALL keep local-only state out of version control, and SHALL not imply that local panel access is production authorization.

#### Scenario: The repository is checked for credentials
- **WHEN** the tracked scaffold and example environment files are inspected
- **THEN** no password, token, private key, or live database credential is present

### Requirement: PHP quality gates are available

The backoffice SHALL expose commands for formatting/linting, application tests, and route/configuration inspection, and its baseline tests SHALL run without relying on an external production database or queue.

#### Scenario: A backoffice change is validated
- **WHEN** an engineer runs the documented PHP validation commands
- **THEN** formatting and application test failures are reported as backoffice failures and the baseline suite can execute against the local test configuration
