CREATE INDEX IF NOT EXISTS idx_th_widget
  ON terminal_history(workspace_id, widget_id, timestamp DESC);
