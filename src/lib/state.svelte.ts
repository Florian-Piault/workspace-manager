import Database from '@tauri-apps/plugin-sql';
import type { Workspace, Layout, Panel, WidgetType } from './types';
import {
  splitPanel as splitPanelHelper,
  assignWidget as assignWidgetHelper,
  closePanel as closePanelHelper,
  updateNodeConfig as updateNodeConfigHelper,
  updateWidgetLabel as updateWidgetLabelHelper,
  updatePanelSizes as updatePanelSizesHelper,
  moveWidgetNode as moveWidgetNodeHelper,
  makeInitialRoot,
  nodeExists,
  findPanelById,
  type DropSide,
} from './layout';

export type { DropSide };

export class WorkspaceStore {
  workspaces = $state<Workspace[]>([]);
  activeWorkspaceId = $state<string | null>(null);
  activePanelId = $state<string | null>(null);
  layouts = $state<Record<string, Layout>>({});
  savingWidgets = $state<Set<string>>(new Set());
  dirtyWidgets = $state<Set<string>>(new Set());
  maximizedPanelId = $state<string | null>(null);
  draggingWidgetId = $state<string | null>(null);
  dragHoverTargetId = $state<string | null>(null);
  dragHoverSide = $state<DropSide | null>(null);
  autoLabels = $state<Map<string, string>>(new Map());

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

    // Apply saved workspace order from localStorage
    try {
      const saved = localStorage.getItem('ws-order');
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        const ordered = ids.flatMap((id) => this.workspaces.filter((w) => w.id === id));
        const rest = this.workspaces.filter((w) => !ids.includes(w.id));
        this.workspaces = [...ordered, ...rest];
      }
    } catch { /* ignore */ }

    for (const row of layoutRows) {
      const parsed = JSON.parse(row.config);
      const root = parsed.children?.length === 0 ? makeInitialRoot() : parsed;
      const layout: Layout = {
        id: row.id,
        workspaceId: row.workspace_id,
        root,
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

  closePanelInWorkspace(workspaceId: string, nodeId: string): void {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws?.layoutId) return;
    const layout = this.layouts[ws.layoutId];
    if (!layout) return;
    const newRoot = closePanelHelper(layout.root, nodeId);
    this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
    if (this.activePanelId === nodeId) this.activePanelId = null;
    this.saveLayout(workspaceId, newRoot).catch((err) => {
      console.error('[WorkspaceStore] closePanelInWorkspace save failed:', err);
    });
  }

  setSaving(nodeId: string, saving: boolean): void {
    const next = new Set(this.savingWidgets);
    if (saving) next.add(nodeId);
    else next.delete(nodeId);
    this.savingWidgets = next;
  }

  setDirty(nodeId: string, dirty: boolean): void {
    const next = new Set(this.dirtyWidgets);
    if (dirty) next.add(nodeId);
    else next.delete(nodeId);
    this.dirtyWidgets = next;
  }

  toggleMaximize(nodeId: string): void {
    this.maximizedPanelId = this.maximizedPanelId === nodeId ? null : nodeId;
  }

  startDrag(widgetId: string): void {
    this.draggingWidgetId = widgetId;
    this.dragHoverTargetId = null;
    this.dragHoverSide = null;
  }

  endDrag(): void {
    this.draggingWidgetId = null;
    this.dragHoverTargetId = null;
    this.dragHoverSide = null;
  }

  setDragHover(targetId: string | null, side: DropSide | null): void {
    this.dragHoverTargetId = targetId;
    this.dragHoverSide = side;
  }

  dropWidget(targetId: string, side: DropSide, sourceIdFromDrop: string | null = null): void {
    const sourceId = sourceIdFromDrop ?? this.draggingWidgetId;
    if (!sourceId || sourceId === targetId) {
      this.draggingWidgetId = null;
      return;
    }
    const layout = this.activeLayout;
    if (!layout) {
      this.draggingWidgetId = null;
      return;
    }
    const newRoot = moveWidgetNodeHelper(layout.root, sourceId, targetId, side);
    this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
    this.draggingWidgetId = null;
    this.dragHoverTargetId = null;
    this.dragHoverSide = null;
    this._debouncedSave();
  }

  reorderWorkspaces(newOrder: Workspace[]): void {
    this.workspaces = [...newOrder];
    try {
      localStorage.setItem('ws-order', JSON.stringify(newOrder.map((w) => w.id)));
    } catch { /* ignore */ }
  }

  updateWidgetConfig(nodeId: string, config: Record<string, unknown>): void {
    const layout = this.activeLayout;
    if (!layout) return;
    // Nœud supprimé (ex: onDestroy async du terminal après closePanel) → skip
    if (!nodeExists(layout.root, nodeId)) return;
    const newRoot = updateNodeConfigHelper(layout.root, nodeId, config);
    this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
    this._debouncedSave();
  }

  updatePanelSizes(nodeId: string, sizes: number[]): void {
    const layout = this.activeLayout;
    if (!layout) return;
    // Nœud absent (panel collapsé après removeNode) → skip
    const current = findPanelById(layout.root, nodeId);
    if (!current) return;
    // Epsilon guard : bruit flottant de paneforge
    if (current.sizes.length === sizes.length && current.sizes.every((s, i) => Math.abs(s - sizes[i]) < 0.01)) return;
    const newRoot = updatePanelSizesHelper(layout.root, nodeId, sizes);
    // Partage structurel : si rien n'a changé dans l'arbre, ne pas re-déclencher Svelte
    if (newRoot === layout.root) return;
    this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
    this._debouncedSave();
  }

  setAutoLabel(nodeId: string, label: string): void {
    const next = new Map(this.autoLabels);
    if (label) next.set(nodeId, label);
    else next.delete(nodeId);
    this.autoLabels = next;
  }

  updateWidgetLabel(nodeId: string, label: string): void {
    const layout = this.activeLayout;
    if (!layout) return;
    const newRoot = updateWidgetLabelHelper(layout.root, nodeId, label);
    this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
    this._debouncedSave();
  }

  async renameWorkspace(workspaceId: string, name: string): Promise<void> {
    this.workspaces = this.workspaces.map((w) =>
      w.id === workspaceId ? { ...w, name } : w
    );
    await this.db!.execute('UPDATE workspaces SET name = ? WHERE id = ?', [name, workspaceId]);
  }

  async closeWorkspace(workspaceId: string): Promise<void> {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return;

    if (ws.layoutId) {
      const { [ws.layoutId]: _, ...rest } = this.layouts;
      this.layouts = rest;
      await this.db!.execute('DELETE FROM layouts WHERE id = ?', [ws.layoutId]);
    }

    this.workspaces = this.workspaces.filter((w) => w.id !== workspaceId);
    if (this.activeWorkspaceId === workspaceId) this.activeWorkspaceId = null;
    await this.db!.execute('DELETE FROM workspaces WHERE id = ?', [workspaceId]);
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

    layoutId = ws.layoutId ?? crypto.randomUUID();
    await this.db!.execute(
      'INSERT OR REPLACE INTO layouts (id, workspace_id, config) VALUES (?, ?, ?)',
      [layoutId, workspaceId, config]
    );

    const layout: Layout = { id: layoutId, workspaceId, root };
    this.layouts = { ...this.layouts, [layoutId]: layout };
    this.workspaces = this.workspaces.map((w) =>
      w.id === workspaceId ? { ...w, layoutId } : w
    );
  }
}

export const store = new WorkspaceStore();
