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
  entries = $state<HistoryEntry[]>([]);
  private db: Database | null = null;
  private loadedWorkspace: string | null = null;

  async init() {
    this.db = await Database.load('sqlite:workspace.db');
  }

  async load(workspaceId: string): Promise<HistoryEntry[]> {
    if (!this.db) return [];
    if (this.loadedWorkspace === workspaceId) return this.entries;
    this.loadedWorkspace = workspaceId;
    const rows = await this.db.select<DbRow[]>(
      'SELECT * FROM terminal_history WHERE workspace_id = ? ORDER BY timestamp DESC LIMIT 50',
      [workspaceId]
    );
    this.entries = rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      widgetId: r.widget_id,
      command: r.command,
      timestamp: r.timestamp,
    }));
    return this.entries;
  }

  async add(workspaceId: string, widgetId: string, command: string) {
    if (!this.db || !command.trim()) return;
    if (this.entries[0]?.command === command) return; // dédupliquer consécutifs
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      workspaceId,
      widgetId,
      command,
      timestamp: Date.now(),
    };
    await this.db.execute(
      'INSERT INTO terminal_history (id, workspace_id, widget_id, command, timestamp) VALUES (?, ?, ?, ?, ?)',
      [entry.id, workspaceId, widgetId, command, entry.timestamp]
    );
    this.entries = [entry, ...this.entries].slice(0, 50);
  }
}

export const terminalHistory = new TerminalHistoryStore();
