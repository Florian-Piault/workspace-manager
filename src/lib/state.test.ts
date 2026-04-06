import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @tauri-apps/plugin-sql avant tout import
const mockDb = {
  select: vi.fn(),
  execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
};
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue(mockDb) },
}));

// Import après le mock
const { WorkspaceStore } = await import('./state.svelte.ts');

describe('WorkspaceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockResolvedValue([]);
  });

  it('init charge les workspaces depuis la DB', async () => {
    mockDb.select
      .mockResolvedValueOnce([{ id: 'ws1', name: 'Projet A', path: '/a' }])
      .mockResolvedValueOnce([]);

    const store = new WorkspaceStore();
    await store.init();

    expect(store.workspaces).toHaveLength(1);
    expect(store.workspaces[0].name).toBe('Projet A');
    expect(store.workspaces[0].layoutId).toBeNull();
  });

  it('addWorkspace insère en DB et met à jour le store', async () => {
    mockDb.select.mockResolvedValue([]);
    const store = new WorkspaceStore();
    await store.init();

    const ws = await store.addWorkspace('Nouveau', '/Users/me/nouveau');

    expect(mockDb.execute).toHaveBeenCalledWith(
      'INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)',
      expect.arrayContaining(['Nouveau', '/Users/me/nouveau'])
    );
    expect(store.workspaces).toHaveLength(1);
    expect(ws.name).toBe('Nouveau');
    expect(ws.layoutId).toBeNull();
  });

  it('setActiveWorkspace met à jour activeWorkspaceId', async () => {
    mockDb.select.mockResolvedValue([]);
    const store = new WorkspaceStore();
    await store.init();
    await store.addWorkspace('A', '/a');

    store.setActiveWorkspace(store.workspaces[0].id);

    expect(store.activeWorkspaceId).toBe(store.workspaces[0].id);
  });
});

describe('WorkspaceStore — layout mutations & debounce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockResolvedValue([]);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setActiveWorkspace crée un layout initial en mémoire si aucun layout', async () => {
    const store = new WorkspaceStore();
    await store.init();
    await store.addWorkspace('A', '/a');

    store.setActiveWorkspace(store.workspaces[0].id);

    expect(store.activeLayout).not.toBeNull();
    expect(store.activeLayout!.root.children).toHaveLength(1);
    expect((store.activeLayout!.root.children[0] as { type: string }).type).toBe('empty');
  });

  it('splitPanel met à jour activeLayout', async () => {
    const store = new WorkspaceStore();
    await store.init();
    await store.addWorkspace('A', '/a');
    store.setActiveWorkspace(store.workspaces[0].id);

    const childId = store.activeLayout!.root.children[0].id;
    store.splitPanel(childId, 'horizontal');

    expect(store.activeLayout!.root.children).toHaveLength(1);
    const inner = store.activeLayout!.root.children[0] as import('./types').Panel;
    expect(inner.children).toHaveLength(2);
  });

  it('mutations multiples rapides → un seul appel saveLayout après 1s', async () => {
    const store = new WorkspaceStore();
    await store.init();
    await store.addWorkspace('A', '/a');
    store.setActiveWorkspace(store.workspaces[0].id);

    const childId = store.activeLayout!.root.children[0].id;
    store.splitPanel(childId, 'horizontal');
    store.splitPanel(childId, 'vertical');
    store.splitPanel(childId, 'horizontal');

    const layoutCallsBefore = mockDb.execute.mock.calls.filter(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('layouts')
    );
    expect(layoutCallsBefore).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1000);

    const layoutCallsAfter = mockDb.execute.mock.calls.filter(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('layouts')
    );
    expect(layoutCallsAfter).toHaveLength(1);
  });

  it('updateWidgetConfig met à jour le config du widget et déclenche un save', async () => {
    const store = new WorkspaceStore();
    await store.init();
    await store.addWorkspace('A', '/a');
    store.setActiveWorkspace(store.workspaces[0].id);

    const widgetId = store.activeLayout!.root.children[0].id;
    store.updateWidgetConfig(widgetId, { scrollback: 'base64data' });

    const widget = store.activeLayout!.root.children[0] as import('./types').Widget;
    expect(widget.config).toEqual({ scrollback: 'base64data' });

    await vi.advanceTimersByTimeAsync(1000);
    const layoutCalls = mockDb.execute.mock.calls.filter(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('layouts')
    );
    expect(layoutCalls).toHaveLength(1);
  });
});
