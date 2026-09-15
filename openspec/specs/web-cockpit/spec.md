# web-cockpit Specification

## Purpose

The web cockpit gives operators a single, server-first view of project context, memory retrieval, dependency policy, and the declarative skills available to a SibylHub workspace.

## Requirements

### Requirement: The cockpit SHALL provide a stable server-first observatory shell

The cockpit SHALL render the project identity, navigation, primary telemetry headings, and the latest available observatory snapshot in the initial document. Browser code SHALL be limited to focused interactive regions, and the first hydrated render SHALL preserve the server-rendered values and status messages.

#### Scenario: Initial local load without optional services
- **WHEN** an operator opens the cockpit while D1, R2, Vectorize, and Workers AI are unavailable
- **THEN** the response contains the complete shell and deterministic local context snapshot, labels the snapshot as local or degraded, and does not show a blank loading shell

#### Scenario: Hydration preserves the initial snapshot
- **WHEN** an interactive region becomes visible and its browser code hydrates
- **THEN** its first client render contains the same project, metric, and availability values as the server-rendered HTML, without a loading-content replacement or layout shift caused by missing initial data

### Requirement: The project context endpoint SHALL return a versioned context snapshot

`GET /api/project/context` SHALL return a versioned JSON document for the selected project. It SHALL accept an optional `project_id` query parameter; when omitted, it SHALL use the configured active project or the deterministic local project in local mode. A D1-backed response SHALL identify its project and source revision, report the context ceiling and current usage, and include dependency evidence sufficient for the dependency audit view.

The response SHALL include:

- `schemaVersion`, `source`, and `project` identity fields;
- `budget.ceilingTokens`, `budget.usedTokens`, `budget.usagePercent`, `budget.quotaState`, and `budget.rtkSavings`;
- five budget partitions named `rules`, `memories`, `ast`, `active`, and `tools`, each with allocated tokens and a percentage of the ceiling;
- dependency records with stable package identity, runtime or package-manager evidence, policy state, and invariant details when available.

The partition allocation SHALL use Rules 10%, Memories 15%, AST 35%, Active 30%, and Tools 10%. Integer allocations SHALL use deterministic largest-remainder rounding and SHALL total exactly the requested ceiling. Quota state SHALL be `nominal` below 70%, `warning` from 70% through below 85%, `critical` from 85% through 95%, and `overflow` above 95% of the ceiling.

#### Scenario: D1 returns a project snapshot
- **WHEN** the endpoint receives a valid project selection and a valid D1 context record
- **THEN** it returns HTTP 200 with the versioned snapshot, five complete partitions, exact integer budget totals, and the recorded dependency evidence

#### Scenario: The project is unknown
- **WHEN** a valid `project_id` does not identify a known project
- **THEN** the endpoint returns HTTP 404 with a stable error code and no SQL details

#### Scenario: The project selection is malformed
- **WHEN** `project_id` contains an invalid or unsafe value
- **THEN** the endpoint returns HTTP 400 with a stable validation error and does not query an unbounded or interpolated data source

#### Scenario: The local baseline has no D1 binding
- **WHEN** the endpoint runs in local mode without D1 resources
- **THEN** it returns the deterministic local snapshot with `source` set to `local` and clearly marks live project data as unavailable

#### Scenario: A configured context source is unavailable or invalid
- **WHEN** the endpoint cannot read or validate the configured D1 snapshot
- **THEN** it returns HTTP 503 with a stable `PROJECT_CONTEXT_UNAVAILABLE` error code and does not report the snapshot as compliant or current

### Requirement: The context observatory SHALL expose partition usage and quota meaning

The observatory SHALL show the five context partitions, their token allocations and percentages, total usage against the active ceiling, the quota state, and RTK savings. It SHALL use the shared semantic telemetry vocabulary so that state meaning is consistent across the cockpit and the design system.

#### Scenario: Nominal usage is displayed
- **WHEN** current usage is below 70% of the active ceiling
- **THEN** the observatory labels the state nominal and shows all five partition values

#### Scenario: Critical or overflow usage is displayed
- **WHEN** current usage is at least 85% of the active ceiling
- **THEN** the observatory labels critical usage through 95% and overflow above 95%, with readable text in addition to color or animation

#### Scenario: RTK savings are absent from the source
- **WHEN** a context snapshot has no recorded RTK savings value
- **THEN** the observatory uses the agreed default `-74.2%` and identifies it as the default rather than displaying an empty metric

### Requirement: The memory query endpoint SHALL perform bounded semantic retrieval

`POST /api/memory/query` SHALL accept a JSON body containing a non-empty `query` of at most 256 characters, an optional project identifier, and an optional result limit of at most 10. Unknown request fields, malformed JSON, invalid limits, credentials, private keys, and executable directives SHALL be rejected without provider calls.

For a valid request with configured services, the endpoint SHALL return a versioned result containing the normalized query status and at most the requested number of matches. Each match SHALL contain a stable memory identifier, title, category, bounded content preview, similarity score, and persisted access counter. The endpoint SHALL not increment counters as part of a read query.

#### Scenario: A valid query returns ranked matches
- **WHEN** the request is valid and Workers AI, Vectorize, and the approved metadata source are available
- **THEN** the endpoint returns HTTP 200 with at most 10 ranked matches containing similarity scores and access counters, without exposing provider credentials or raw provider errors

#### Scenario: A query has no matches
- **WHEN** the request is valid and semantic retrieval returns no approved memories
- **THEN** the endpoint returns HTTP 200 with an empty match list and an explicit no-matches status

#### Scenario: A query is invalid
- **WHEN** the request is malformed, empty, oversized, contains unknown fields, or requests more than 10 results
- **THEN** the endpoint returns HTTP 400 with a stable validation error and performs no embedding or vector query

#### Scenario: Semantic services are unavailable
- **WHEN** Workers AI, Vectorize, or the approved metadata source is not configured or cannot be reached
- **THEN** the endpoint returns HTTP 503 with a stable `MEMORY_SEARCH_UNAVAILABLE` error code and omits provider details from the response and logs

### Requirement: The memory graph view SHALL distinguish retrieval states

The memory view SHALL present each returned memory as a searchable context node or result card with its title, category, similarity score, and access counter. It SHALL distinguish successful results, no matches, and unavailable semantic services, and SHALL never present an unavailable service as an empty or compliant result.

#### Scenario: Matches are rendered
- **WHEN** the memory endpoint returns one or more matches
- **THEN** the view renders the matches in descending relevance order with readable scores and access counters

#### Scenario: No matches are rendered
- **WHEN** the memory endpoint returns a successful empty result
- **THEN** the view displays a no-matches state and preserves the query controls

#### Scenario: Retrieval is unavailable
- **WHEN** the memory endpoint reports `MEMORY_SEARCH_UNAVAILABLE`
- **THEN** the view displays an unavailable state and does not claim that the project has no relevant memories

### Requirement: The dependency audit view SHALL make policy evidence explicit

The dependency view SHALL show active repository dependencies using stable package identity, runtime or package-manager evidence, and one of `compliant`, `warning`, `violation`, `unconfigured`, or `unavailable` policy states. A warning or violation SHALL include the invariant name, severity, reason, and an approved replacement when available. The view SHALL not infer compliance from missing or stale evidence.

#### Scenario: Approved dependency evidence is displayed
- **WHEN** a dependency matches an approved package and its required runtime evidence is present
- **THEN** the view marks it compliant and shows the evidence used for that decision

#### Scenario: A banned dependency is displayed
- **WHEN** a dependency matches a banned package or violates a stack invariant
- **THEN** the view highlights the violation with its severity, reason, and approved replacement when one is defined

#### Scenario: Audit evidence is unavailable
- **WHEN** the registry or invariant service is unavailable or the snapshot is stale
- **THEN** the view marks the affected records unavailable or unconfigured and does not mark them compliant

### Requirement: The skill catalog SHALL use safe declarative drafts

The skill catalog SHALL display only entries from a versioned, validated catalog. Each entry SHALL expose a stable identifier, scope, declarative status, and audit state. Only entries that are explicitly marked audited and declarative SHALL be eligible for enabling. Changes SHALL remain local to the browser until exported or handed to an explicit CLI apply action.

The export SHALL validate a `SkillsDocument` before producing `.agent/skills.json`, preserve the supported schema version and stable ordering, and reject credentials, private keys, executable directives, unsupported versions, and malformed entries. The web Worker SHALL not mutate the tracked project file directly.

#### Scenario: An audited skill is toggled
- **WHEN** an operator enables or disables an eligible catalog entry
- **THEN** the catalog updates the local draft, exposes the changed state to assistive technology, and indicates that the draft is not yet applied to the workspace

#### Scenario: A non-audited or non-declarative entry is shown
- **WHEN** the catalog contains an entry that is not both audited and declarative
- **THEN** the entry remains visible with its blocked state and cannot be enabled through the catalog

#### Scenario: A valid draft is exported
- **WHEN** the operator exports a valid local draft
- **THEN** the browser produces a deterministic `.agent/skills.json` document and does not make a remote mutation

#### Scenario: An unsafe draft is exported
- **WHEN** a draft contains an unsupported version, malformed skill, secret-like value, or executable directive
- **THEN** export is refused with a user-readable validation error and no file is produced

### Requirement: The cockpit SHALL remain accessible and usable on narrow layouts

All controls SHALL have accessible names and keyboard operation. State SHALL not be conveyed by color or animation alone. The layout SHALL avoid horizontal overflow at a 320 CSS pixel viewport, and reduced-motion preferences SHALL disable nonessential animation.

#### Scenario: Keyboard navigation is used
- **WHEN** an operator uses only a keyboard to switch projects, expand or collapse navigation, query memories, toggle a skill, and export a draft
- **THEN** every control is reachable in logical order, exposes its state, and has a visible focus indication

#### Scenario: Reduced motion is requested
- **WHEN** the user agent advertises `prefers-reduced-motion: reduce`
- **THEN** nonessential radar, pulse, gauge, and transition animations are disabled while state and values remain available

### Requirement: Cockpit requests SHALL be bounded and secret-safe

The cockpit SHALL avoid unbounded scans and client polling. A context request SHALL use a bounded project snapshot read. A memory request SHALL perform at most one embedding and one bounded vector search followed by bounded metadata hydration. Request content, credentials, private keys, and raw upstream failures SHALL not be written to logs, URLs, tracked configuration, or client error payloads.

#### Scenario: A memory request exceeds the configured bound
- **WHEN** a request asks for more than 10 results or a query exceeds the accepted length
- **THEN** validation fails before any external service call

#### Scenario: A provider returns an unexpected failure
- **WHEN** an upstream service returns an error or malformed data
- **THEN** the route returns its stable safe error contract, records only non-sensitive diagnostic context if logging is enabled, and does not expose the upstream response
