CREATE TABLE IF NOT EXISTS quick_actions (
    id          TEXT    PRIMARY KEY,
    workspace_id TEXT   NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    label       TEXT    NOT NULL,
    command     TEXT    NOT NULL,
    args        TEXT    NOT NULL DEFAULT '[]',
    cwd         TEXT,
    auto_restart INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
);
