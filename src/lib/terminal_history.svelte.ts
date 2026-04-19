import Database from '@tauri-apps/plugin-sql';

export interface HistoryEntry {
  id: string;
  workspaceId: string;
  widgetId: string;
  command: string;
  timestamp: number;
}

type DbRow = {
  id: string;
  workspace_id: string;
  widget_id: string;
  command: string;
  timestamp: number;
};

class TerminalHistoryStore {
  private entriesByWidget = $state<Map<string, HistoryEntry[]>>(new Map());
  private db: Database | null = null;

  async init() {
    this.db = await Database.load('sqlite:workspace.db');
  }

  async load(workspaceId: string, widgetId: string): Promise<HistoryEntry[]> {
    if (!this.db) return [];
    if (this.entriesByWidget.has(widgetId)) return this.entriesByWidget.get(widgetId)!;
    const rows = await this.db.select<DbRow[]>(
      'SELECT * FROM terminal_history WHERE workspace_id = ? AND widget_id = ? ORDER BY timestamp DESC LIMIT 50',
      [workspaceId, widgetId]
    );
    const entries = rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      widgetId: r.widget_id,
      command: r.command,
      timestamp: r.timestamp,
    }));
    this.entriesByWidget.set(widgetId, entries);
    return entries;
  }

  async add(workspaceId: string, widgetId: string, command: string) {
    if (!this.db || !command.trim()) return;
    const current = this.entriesByWidget.get(widgetId) ?? [];
    if (current[0]?.command === command) return; // dédupliquer consécutifs par widget
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      workspaceId,
      widgetId,
      command,
      timestamp: Date.now(),
    };
    await this.db.execute(
      'INSERT INTO terminal_history (id, workspace_id, widget_id, command, timestamp) VALUES (?, ?, ?, ?, ?)',
      [entry.id, workspaceId, widgetId, entry.command, entry.timestamp]
    );
    this.entriesByWidget.set(widgetId, [entry, ...current].slice(0, 50));
  }

  async delete(widgetId: string) {
    if (!this.db) return;
    await this.db.execute('DELETE FROM terminal_history WHERE widget_id = ?', [widgetId]);
    this.entriesByWidget.delete(widgetId);
  }
}

export const terminalHistory = new TerminalHistoryStore();
