import { describe, it, expect, vi, beforeEach } from 'vitest';

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
