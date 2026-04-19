CREATE TABLE IF NOT EXISTS terminal_history (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  widget_id    TEXT NOT NULL,
  command      TEXT NOT NULL,
  timestamp    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_th_workspace
  ON terminal_history(workspace_id, timestamp DESC);
