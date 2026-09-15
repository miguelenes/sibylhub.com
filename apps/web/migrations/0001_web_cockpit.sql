CREATE TABLE IF NOT EXISTS project_context_snapshots (
  project_id TEXT NOT NULL CHECK (length(project_id) BETWEEN 1 AND 64),
  project_name TEXT NOT NULL CHECK (length(project_name) BETWEEN 1 AND 256),
  source_revision TEXT NOT NULL CHECK (length(source_revision) BETWEEN 1 AND 256),
  context_ceiling_tokens INTEGER NOT NULL CHECK (context_ceiling_tokens > 0),
  rules_used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (rules_used_tokens >= 0),
  memories_used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (memories_used_tokens >= 0),
  ast_used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (ast_used_tokens >= 0),
  active_used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (active_used_tokens >= 0),
  tools_used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (tools_used_tokens >= 0),
  rtk_savings TEXT,
  snapshot_status TEXT NOT NULL DEFAULT 'ready' CHECK (snapshot_status IN ('ready', 'stale')),
  captured_at TEXT NOT NULL,
  PRIMARY KEY (project_id, source_revision)
);

CREATE INDEX IF NOT EXISTS project_context_snapshots_latest_idx
  ON project_context_snapshots (project_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS project_dependencies (
  dependency_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL CHECK (length(project_id) BETWEEN 1 AND 64),
  snapshot_revision TEXT NOT NULL CHECK (length(snapshot_revision) BETWEEN 1 AND 256),
  package_name TEXT NOT NULL CHECK (length(package_name) BETWEEN 1 AND 256),
  package_version TEXT NOT NULL CHECK (length(package_version) BETWEEN 1 AND 128),
  purl_json TEXT,
  runtime TEXT,
  package_manager TEXT,
  evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (length(evidence_json) <= 16384),
  policy_state TEXT NOT NULL CHECK (policy_state IN ('compliant', 'warning', 'violation', 'unconfigured', 'unavailable')),
  invariant_name TEXT,
  invariant_severity TEXT,
  invariant_reason TEXT,
  approved_replacement TEXT,
  captured_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS project_dependencies_snapshot_idx
  ON project_dependencies (project_id, snapshot_revision, dependency_id);
CREATE INDEX IF NOT EXISTS project_dependencies_policy_idx
  ON project_dependencies (project_id, policy_state, captured_at DESC);

CREATE TABLE IF NOT EXISTS memory_entries (
  memory_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL CHECK (length(project_id) BETWEEN 1 AND 64),
  vectorize_id TEXT NOT NULL UNIQUE CHECK (length(vectorize_id) BETWEEN 1 AND 256),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 256),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 128),
  content_preview TEXT NOT NULL CHECK (length(content_preview) <= 1024),
  source_revision TEXT NOT NULL CHECK (length(source_revision) BETWEEN 1 AND 256),
  access_count INTEGER NOT NULL DEFAULT 0 CHECK (access_count >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS memory_entries_project_updated_idx
  ON memory_entries (project_id, active, updated_at DESC, memory_id);
