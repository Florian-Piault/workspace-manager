import Database from '@tauri-apps/plugin-sql';
import type { Workspace, Layout, Panel, WidgetType } from './types';
import {
  splitPanel as splitPanelHelper,
  assignWidget as assignWidgetHelper,
  closePanel as closePanelHelper,
  makeInitialRoot,
} from './layout';

export class WorkspaceStore {
  workspaces = $state<Workspace[]>([]);
  activeWorkspaceId = $state<string | null>(null);
  activePanelId = $state<string | null>(null);
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
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    this.db = await Database.load('sqlite:workspace.db');

    const wsRows = await this.db.select<Array<{ id: string; name: string; path: string }>>(
      'SELECT * FROM workspaces'
    );
    const layoutRows = await this.db.select<Array<{ id: string; workspace_id: string; config: string }>>(
      'SELECT id, workspace_id, config FROM layouts'
    );

    const layoutByWorkspace = new Map(layoutRows.map((r) => [r.workspace_id, r]));
    this.workspaces = wsRows.map((r) => ({
      ...r,
      layoutId: layoutByWorkspace.get(r.id)?.id ?? null,
    }));

    for (const row of layoutRows) {
      const layout: Layout = {
        id: row.id,
        workspaceId: row.workspace_id,
        root: JSON.parse(row.config),
      };
      this.layouts = { ...this.layouts, [row.id]: layout };
    }
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
    this.activePanelId = null;
    if (id) {
      const ws = this.workspaces.find((w) => w.id === id);
      if (ws && !ws.layoutId) {
        const root = makeInitialRoot();
        const layoutId = crypto.randomUUID();
        const layout: Layout = { id: layoutId, workspaceId: id, root };
        this.layouts = { ...this.layouts, [layoutId]: layout };
        this.workspaces = this.workspaces.map((w) =>
          w.id === id ? { ...w, layoutId } : w
        );
        this._debouncedSave();
      }
    }
  }

  setActivePanel(id: string | null): void {
    this.activePanelId = id;
  }

  splitPanel(nodeId: string, direction: 'horizontal' | 'vertical'): void {
    const layout = this.activeLayout;
    if (!layout) return;
    const newRoot = splitPanelHelper(layout.root, nodeId, direction);
    this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
    this._debouncedSave();
  }

  assignWidget(nodeId: string, type: Exclude<WidgetType, 'empty'>): void {
    const layout = this.activeLayout;
    if (!layout) return;
    const newRoot = assignWidgetHelper(layout.root, nodeId, type);
    this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
    this._debouncedSave();
  }

  closePanel(nodeId: string): void {
    const layout = this.activeLayout;
    if (!layout) return;
    const newRoot = closePanelHelper(layout.root, nodeId);
    this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
    if (this.activePanelId === nodeId) this.activePanelId = null;
    this._debouncedSave();
  }

  private _debouncedSave(): void {
    if (this._saveTimer !== null) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      this._saveTimer = null;
      const layout = this.activeLayout;
      if (!layout || !this.activeWorkspaceId || !this.db) return;
      await this.saveLayout(this.activeWorkspaceId, layout.root).catch((err) => {
        console.error('[WorkspaceStore] saveLayout failed:', err);
      });
    }, 1000);
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
