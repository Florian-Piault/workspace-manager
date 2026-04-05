import Database from '@tauri-apps/plugin-sql';
import type { Workspace, Layout, Panel } from './types';

export class WorkspaceStore {
  workspaces = $state<Workspace[]>([]);
  activeWorkspaceId = $state<string | null>(null);
  layouts = $state<Record<string, Layout>>({});

  activeWorkspace = $derived(
    this.workspaces.find((w) => w.id === this.activeWorkspaceId) ?? null
  );

  activeLayout = $derived(
    this.activeWorkspace?.layoutId
      ? (this.layouts[this.activeWorkspace.layoutId] ?? null)
      : null
  );

  private db: Database | null = null;

  async init(): Promise<void> {
    this.db = await Database.load('sqlite:workspace.db');

    const wsRows = await this.db.select<Array<{ id: string; name: string; path: string }>>(
      'SELECT * FROM workspaces'
    );
    const layoutRows = await this.db.select<Array<{ id: string; workspace_id: string }>>(
      'SELECT id, workspace_id FROM layouts'
    );

    const layoutByWorkspace = new Map(layoutRows.map((r) => [r.workspace_id, r.id]));
    this.workspaces = wsRows.map((r) => ({
      ...r,
      layoutId: layoutByWorkspace.get(r.id) ?? null,
    }));
  }

  async addWorkspace(name: string, path: string): Promise<Workspace> {
    const id = crypto.randomUUID();
    await this.db!.execute('INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)', [
      id,
      name,
      path,
    ]);
    const workspace: Workspace = { id, name, path, layoutId: null };
    this.workspaces = [...this.workspaces, workspace];
    return workspace;
  }

  setActiveWorkspace(id: string | null): void {
    this.activeWorkspaceId = id;
  }

  async saveLayout(workspaceId: string, root: Panel): Promise<void> {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return;

    const config = JSON.stringify(root);
    let layoutId: string;

    if (ws.layoutId) {
      layoutId = ws.layoutId;
      await this.db!.execute('UPDATE layouts SET config = ? WHERE id = ?', [config, layoutId]);
    } else {
      layoutId = crypto.randomUUID();
      await this.db!.execute(
        'INSERT INTO layouts (id, workspace_id, config) VALUES (?, ?, ?)',
        [layoutId, workspaceId, config]
      );
    }

    const layout: Layout = { id: layoutId, workspaceId, root };
    this.layouts = { ...this.layouts, [layoutId]: layout };
    this.workspaces = this.workspaces.map((w) =>
      w.id === workspaceId ? { ...w, layoutId } : w
    );
  }
}

export const store = new WorkspaceStore();
