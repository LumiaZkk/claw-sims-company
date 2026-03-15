import type { DatabaseSync } from "node:sqlite";

const AUTHORITY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    lead_agent_id TEXT,
    color TEXT,
    sort_order INTEGER,
    archived INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS employees (
    agent_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    role TEXT NOT NULL,
    is_meta INTEGER NOT NULL DEFAULT 0,
    meta_role TEXT,
    reports_to TEXT,
    department_id TEXT,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS runtimes (
    company_id TEXT PRIMARY KEY,
    snapshot_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS conversations (
    session_key TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    actor_id TEXT,
    kind TEXT NOT NULL,
    label TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    role TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS agent_files (
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (agent_id, name)
  );
  CREATE TABLE IF NOT EXISTS conversation_states (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS work_items (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS requirement_aggregates (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS requirement_evidence (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS room_bindings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS support_requests (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS escalations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS decision_tickets (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dispatches (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS event_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    company_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS executor_configs (
    id TEXT PRIMARY KEY,
    adapter TEXT NOT NULL,
    config_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS executor_runs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS managed_executor_agents (
    agent_id TEXT PRIMARY KEY,
    company_id TEXT,
    desired_present INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );
`;

function writeMetadata(db: DatabaseSync, key: string, value: string) {
  db.prepare(`
    INSERT INTO metadata (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function applyAuthoritySchema(input: {
  db: DatabaseSync;
  schemaVersion: number;
  defaultExecutorConfig: unknown;
}) {
  const { db, schemaVersion, defaultExecutorConfig } = input;
  db.exec(AUTHORITY_SCHEMA_SQL);
  writeMetadata(db, "schemaVersion", String(schemaVersion));

  const countRow = db.prepare("SELECT COUNT(*) as count FROM executor_configs").get() as
    | { count?: number }
    | undefined;
  if (!countRow?.count) {
    db.prepare(
      "INSERT INTO executor_configs (id, adapter, config_json, updated_at) VALUES (?, ?, ?, ?)",
    ).run("default", "openclaw-bridge", JSON.stringify(defaultExecutorConfig), Date.now());
  }
}
