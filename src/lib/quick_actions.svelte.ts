import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type ActionStatus = 'idle' | 'running' | 'success' | 'error';

export interface DetectedAction {
  id: string;
  source: string;
  label: string;
  command: string;
  icon: string;
  isPinned: boolean;
}

export interface QuickAction {
  id: string;
  workspaceId: string;
  label: string;
  command: string;
  args: string[];
  cwd: string | null;
  autoRestart: boolean;
  sortOrder: number;
}

type DbRow = {
  id: string;
  workspace_id: string;
  label: string;
  command: string;
  args: string;
  cwd: string | null;
  auto_restart: number;
  sort_order: number;
};

function rowToAction(r: DbRow): QuickAction {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    label: r.label,
    command: r.command,
    args: JSON.parse(r.args) as string[],
    cwd: r.cwd,
    autoRestart: r.auto_restart === 1,
    sortOrder: r.sort_order,
  };
}

interface RawDetectedAction {
  id: string;
  source: string;
  label: string;
  command: string;
  icon: string;
}

class QuickActionsStore {
  actions = $state<QuickAction[]>([]);
  detectedActions = $state<DetectedAction[]>([]);
  statuses = $state<Map<string, ActionStatus>>(new Map());
  logs = $state<Map<string, string[]>>(new Map());

  private db: Database | null = null;
  private unlisteners = new Map<string, Array<() => void>>();

  private async getDb(): Promise<Database> {
    if (!this.db) this.db = await Database.load('sqlite:workspace.db');
    return this.db;
  }

  async loadForWorkspace(workspaceId: string): Promise<void> {
    const db = await this.getDb();
    const rows = await db.select<DbRow[]>(
      'SELECT * FROM quick_actions WHERE workspace_id = ? ORDER BY sort_order ASC',
      [workspaceId]
    );
    this.actions = rows.map(rowToAction);
  }

  async create(
    workspaceId: string,
    label: string,
    command: string,
    args: string[],
    cwd: string | null
  ): Promise<void> {
    const db = await this.getDb();
    const id = crypto.randomUUID();
    const sortOrder = this.actions.length;
    await db.execute(
      'INSERT INTO quick_actions (id, workspace_id, label, command, args, cwd, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, workspaceId, label, command, JSON.stringify(args), cwd || null, sortOrder]
    );
    this.actions = [
      ...this.actions,
      { id, workspaceId, label, command, args, cwd, autoRestart: false, sortOrder },
    ];
  }

  async update(id: string, label: string, command: string, args: string[], cwd: string | null): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      'UPDATE quick_actions SET label = ?, command = ?, args = ?, cwd = ? WHERE id = ?',
      [label, command, JSON.stringify(args), cwd || null, id]
    );
    this.actions = this.actions.map(a =>
      a.id === id ? { ...a, label, command, args, cwd } : a
    );
  }

  async delete(id: string): Promise<void> {
    await this.killProcess(id);
    const db = await this.getDb();
    await db.execute('DELETE FROM quick_actions WHERE id = ?', [id]);
    this.actions = this.actions.filter(a => a.id !== id);
    this.statuses = new Map([...this.statuses].filter(([k]) => k !== id));
    this.logs = new Map([...this.logs].filter(([k]) => k !== id));
  }

  async execute(action: QuickAction, defaultCwd: string): Promise<void> {
    const cwd = action.cwd || defaultCwd;
    this.setStatus(action.id, 'running');
    this.logs = new Map([...this.logs, [action.id, []]]);

    const unlogListen = await listen<string>(`qa_log:${action.id}`, (e) => {
      const current = this.logs.get(action.id) ?? [];
      this.logs = new Map([...this.logs, [action.id, [...current, e.payload]]]);
    });

    const unexitListen = await listen<number>(`qa_exit:${action.id}`, (e) => {
      this.setStatus(action.id, e.payload === 0 ? 'success' : 'error');
      this.cleanListeners(action.id);
    });

    this.unlisteners.set(action.id, [unlogListen, unexitListen]);

    // Splitter la commande pour séparer le binaire de ses arguments éventuels
    // (ex: "pnpm run dev" → program="pnpm", args=["run","dev","...storeArgs"])
    const commandParts = action.command.trim().split(/\s+/);
    const program = commandParts[0];
    const args = [...commandParts.slice(1), ...action.args];

    try {
      await invoke('qa_execute', {
        id: action.id,
        command: program,
        args,
        cwd,
      });
    } catch (err) {
      this.setStatus(action.id, 'error');
      const current = this.logs.get(action.id) ?? [];
      this.logs = new Map([...this.logs, [action.id, [...current, String(err)]]]);
      this.cleanListeners(action.id);
    }
  }

  async killProcess(id: string): Promise<void> {
    await invoke('qa_kill', { id }).catch(() => {});
    this.setStatus(id, 'idle');
    this.cleanListeners(id);
  }

  async scanWorkspace(workspacePath: string): Promise<void> {
    try {
      const raw = await invoke<RawDetectedAction[]>('scan_workspace_actions', { workspacePath });
      const pinnedCommands = new Set(this.actions.map(a => {
        // Reconstruct full command string as stored actions split command/args
        const full = a.args.length ? `${a.command} ${a.args.join(' ')}` : a.command;
        return full;
      }));
      this.detectedActions = raw.map(d => ({
        ...d,
        isPinned: pinnedCommands.has(d.command),
      }));
    } catch {
      this.detectedActions = [];
    }
  }

  clearLogs(id: string): void {
    this.logs = new Map([...this.logs, [id, []]]);
  }

  private setStatus(id: string, status: ActionStatus): void {
    this.statuses = new Map([...this.statuses, [id, status]]);
  }

  private cleanListeners(id: string): void {
    const listeners = this.unlisteners.get(id);
    if (listeners) {
      listeners.forEach(u => u());
      this.unlisteners.delete(id);
    }
  }
}

export const qaStore = new QuickActionsStore();
