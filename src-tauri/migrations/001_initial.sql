CREATE TABLE IF NOT EXISTS workspaces (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS layouts (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  config       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processes (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  command      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'stopped'
);
