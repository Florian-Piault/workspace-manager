# Phase 2 — Layout Dynamique & Création de Workspace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le layout interactif — split/close de panneaux, sélection de widgets, création de workspaces depuis la sidebar, auto-sauvegarde SQLite debouncée.

**Architecture:** Les mutations de l'arbre `PanelNode` sont des fonctions pures dans `src/lib/layout.ts` (testables sans DOM). `WorkspaceStore` délègue à ces helpers et déclenche un `debouncedSave` après chaque mutation. Les composants UI (`PanelOverlay`, `WidgetPicker`, `WorkspaceCreator`) restent légers — ils appellent uniquement des méthodes du store.

**Tech Stack:** Svelte 5 (Runes), SvelteKit, Tauri 2, Tailwind CSS v3, shadcn-svelte (Button, Input, Popover), @lucide/svelte, paneforge, vitest

---

## Structure des fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/lib/types.ts` | Modifier | Ajouter `'empty'` à `WidgetType` |
| `src/lib/layout.ts` | Créer | Helpers purs : `splitPanel`, `closePanel`, `assignWidget`, `makeInitialRoot` |
| `src/lib/layout.test.ts` | Créer | Tests TDD des helpers purs |
| `src/lib/state.svelte.ts` | Modifier | Ajouter `activePanelId`, mutations, layout initial, debounce |
| `src/lib/state.test.ts` | Modifier | Étendre — tests debounce + layout initial |
| `src/lib/components/WidgetPicker.svelte` | Créer | Liste de choix (Code / Terminal / Browser) |
| `src/lib/components/PanelOverlay.svelte` | Créer | Surcouche hover avec boutons split/close |
| `src/lib/components/WorkspaceCreator.svelte` | Créer | Popover de création de workspace |
| `src/lib/components/LayoutEngine.svelte` | Modifier | Intégrer PanelOverlay + WidgetPicker + prop isRoot |
| `src/lib/components/Sidebar.svelte` | Modifier | Ajouter bouton "+" + WorkspaceCreator |
| `src/routes/+page.svelte` | Modifier | Raccourcis clavier |

---

## Task 1 : Helpers purs de layout (TDD)

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/layout.test.ts`
- Create: `src/lib/layout.ts`

- [ ] **Step 1 : Ajouter `'empty'` à WidgetType dans types.ts**

Remplacer la ligne 1 de `src/lib/types.ts` :

```ts
export type WidgetType = 'code' | 'terminal' | 'browser' | 'empty';
```

- [ ] **Step 2 : Écrire les tests (layout.test.ts)**

Créer `src/lib/layout.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { splitPanel, closePanel, assignWidget } from './layout';
import { isPanel } from './types';
import type { Panel, Widget, PanelNode } from './types';

const w = (id: string, type: 'code' | 'terminal' | 'browser' | 'empty' = 'code'): Widget => ({
  id,
  type,
  config: {},
});

const p = (id: string, children: PanelNode[]): Panel => ({
  id,
  direction: 'horizontal',
  sizes: children.map(() => Math.floor(100 / children.length)),
  children,
});

describe('splitPanel', () => {
  it('wraps target in a new Panel with an EmptyWidget sibling', () => {
    const root = p('root', [w('w1')]);
    const result = splitPanel(root, 'w1', 'vertical');

    expect(result.children).toHaveLength(1);
    const inner = result.children[0] as Panel;
    expect(isPanel(inner)).toBe(true);
    expect(inner.direction).toBe('vertical');
    expect(inner.children).toHaveLength(2);
    expect(inner.children[0].id).toBe('w1');
    expect((inner.children[1] as Widget).type).toBe('empty');
  });

  it('works on a nested target', () => {
    const inner = p('inner', [w('w1'), w('w2')]);
    const root = p('root', [inner, w('w3')]);
    const result = splitPanel(root, 'w2', 'horizontal');

    const updatedInner = result.children[0] as Panel;
    const newPanel = updatedInner.children[1] as Panel;
    expect(isPanel(newPanel)).toBe(true);
    expect(newPanel.children[0].id).toBe('w2');
  });
});

describe('closePanel', () => {
  it('removes target and keeps sibling', () => {
    const root = p('root', [w('a'), w('b')]);
    const result = closePanel(root, 'b');

    expect(result.children).toHaveLength(1);
    expect(result.children[0].id).toBe('a');
  });

  it('collapses parent when only 1 child remains after removal', () => {
    const inner = p('inner', [w('a'), w('b')]);
    const root = p('root', [inner, w('c')]);
    const result = closePanel(root, 'b');

    // inner[a,b] → close b → inner[a] → parent collapses inner to a
    expect(result.children).toHaveLength(2);
    expect(result.children[0].id).toBe('a');
    expect(result.children[1].id).toBe('c');
  });
});

describe('assignWidget', () => {
  it('replaces EmptyWidget with the chosen type, keeping same id', () => {
    const root = p('root', [w('w1', 'empty')]);
    const result = assignWidget(root, 'w1', 'terminal');

    const widget = result.children[0] as Widget;
    expect(widget.id).toBe('w1');
    expect(widget.type).toBe('terminal');
  });
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

```bash
pnpm vitest run src/lib/layout.test.ts
```

Expected : FAIL — `Cannot find module './layout'`.

- [ ] **Step 4 : Créer src/lib/layout.ts**

```ts
import { isPanel } from './types';
import type { Panel, PanelNode, WidgetType } from './types';

function mapNode(
  panel: Panel,
  targetId: string,
  mapper: (node: PanelNode) => PanelNode
): Panel {
  return {
    ...panel,
    children: panel.children.map((child) => {
      if (child.id === targetId) return mapper(child);
      if (isPanel(child)) return mapNode(child, targetId, mapper);
      return child;
    }),
  };
}

function removeNode(panel: Panel, targetId: string): Panel {
  const newChildren: PanelNode[] = panel.children.flatMap((child) => {
    if (child.id === targetId) return [];
    if (isPanel(child)) {
      const updated = removeNode(child, targetId);
      if (updated.children.length === 1) return [updated.children[0]];
      return [updated];
    }
    return [child];
  });
  return { ...panel, children: newChildren };
}

export function splitPanel(
  root: Panel,
  targetId: string,
  direction: 'horizontal' | 'vertical'
): Panel {
  return mapNode(root, targetId, (node) => ({
    id: crypto.randomUUID(),
    direction,
    sizes: [50, 50],
    children: [node, { id: crypto.randomUUID(), type: 'empty' as const, config: {} }],
  }));
}

export function assignWidget(
  root: Panel,
  targetId: string,
  type: Exclude<WidgetType, 'empty'>
): Panel {
  return mapNode(root, targetId, () => ({ id: targetId, type, config: {} }));
}

export function closePanel(root: Panel, targetId: string): Panel {
  return removeNode(root, targetId);
}

export function makeInitialRoot(): Panel {
  return {
    id: crypto.randomUUID(),
    direction: 'horizontal',
    sizes: [100],
    children: [{ id: crypto.randomUUID(), type: 'empty', config: {} }],
  };
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
pnpm vitest run src/lib/layout.test.ts
```

Expected : PASS — `4 tests passed`.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/types.ts src/lib/layout.ts src/lib/layout.test.ts
git commit -m "feat: add layout pure helpers (splitPanel, closePanel, assignWidget)"
```

---

## Task 2 : Installer les composants shadcn nécessaires

**Files:** génération automatique dans `src/lib/components/ui/`

- [ ] **Step 1 : Installer Button, Input, Popover**

```bash
pnpm dlx shadcn-svelte@latest add button input popover
```

Expected : les répertoires `src/lib/components/ui/button/`, `src/lib/components/ui/input/`, `src/lib/components/ui/popover/` sont créés.

- [ ] **Step 2 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/ui/ components.json
git commit -m "feat: add shadcn Button, Input, Popover components"
```

---

## Task 3 : Étendre WorkspaceStore (TDD)

**Files:**
- Modify: `src/lib/state.svelte.ts`
- Modify: `src/lib/state.test.ts`

- [ ] **Step 1 : Écrire les nouveaux tests dans state.test.ts**

Ajouter à la fin de `src/lib/state.test.ts`, après le `describe` existant :

```ts
import { afterEach } from 'vitest';

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
});
```

- [ ] **Step 2 : Vérifier que les nouveaux tests échouent**

```bash
pnpm vitest run src/lib/state.test.ts
```

Expected : les 3 anciens passent, les 3 nouveaux FAIL.

- [ ] **Step 3 : Mettre à jour src/lib/state.svelte.ts**

Remplacer le contenu complet :

```ts
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
      await this.saveLayout(this.activeWorkspaceId, layout.root);
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
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
pnpm vitest run src/lib/state.test.ts
```

Expected : PASS — `6 tests passed`.

- [ ] **Step 5 : Vérifier aussi les types**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/state.svelte.ts src/lib/state.test.ts
git commit -m "feat: extend WorkspaceStore with panel mutations and debounced save"
```

---

## Task 4 : Créer WidgetPicker.svelte

**Files:**
- Create: `src/lib/components/WidgetPicker.svelte`

- [ ] **Step 1 : Créer le composant**

```svelte
<script lang="ts">
  import { Code2, Terminal, Globe } from '@lucide/svelte';
  import { store } from '$lib/state.svelte';
  import type { WidgetType } from '$lib/types';

  let { nodeId }: { nodeId: string } = $props();

  const items: { type: Exclude<WidgetType, 'empty'>; label: string; icon: typeof Code2 }[] = [
    { type: 'code', label: 'Code Editor', icon: Code2 },
    { type: 'terminal', label: 'Terminal', icon: Terminal },
    { type: 'browser', label: 'Browser', icon: Globe },
  ];
</script>

<div class="flex h-full w-full items-center justify-center">
  <div class="flex flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-sm">
    {#each items as item}
      <button
        class="flex items-center gap-3 rounded px-4 py-2 text-sm text-muted-foreground
               transition-colors hover:bg-accent hover:text-accent-foreground"
        onclick={() => store.assignWidget(nodeId, item.type)}
      >
        <item.icon class="h-4 w-4 shrink-0" />
        {item.label}
      </button>
    {/each}
  </div>
</div>
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/WidgetPicker.svelte
git commit -m "feat: add WidgetPicker component"
```

---

## Task 5 : Créer PanelOverlay.svelte

**Files:**
- Create: `src/lib/components/PanelOverlay.svelte`

- [ ] **Step 1 : Créer le composant**

```svelte
<script lang="ts">
  import { Columns2, Rows2, X } from '@lucide/svelte';
  import { store } from '$lib/state.svelte';
  import type { Snippet } from 'svelte';

  let {
    nodeId,
    isRoot = false,
    children,
  }: {
    nodeId: string;
    isRoot?: boolean;
    children: Snippet;
  } = $props();

  const isActive = $derived(store.activePanelId === nodeId);
</script>

<div
  class="group relative h-full w-full {isActive ? 'ring-1 ring-primary ring-inset' : ''}"
  onclick={() => store.setActivePanel(nodeId)}
  role="group"
>
  {@render children()}

  <div
    class="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0
           transition-opacity group-hover:opacity-100"
  >
    <button
      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={(e) => { e.stopPropagation(); store.splitPanel(nodeId, 'vertical'); }}
      title="Split vertical"
    >
      <Columns2 class="h-3.5 w-3.5" />
    </button>
    <button
      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={(e) => { e.stopPropagation(); store.splitPanel(nodeId, 'horizontal'); }}
      title="Split horizontal"
    >
      <Rows2 class="h-3.5 w-3.5" />
    </button>
    <button
      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground
             disabled:pointer-events-none disabled:opacity-30"
      disabled={isRoot}
      onclick={(e) => { e.stopPropagation(); store.closePanel(nodeId); }}
      title="Fermer"
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </div>
</div>
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/PanelOverlay.svelte
git commit -m "feat: add PanelOverlay component with split/close controls"
```

---

## Task 6 : Mettre à jour LayoutEngine.svelte

**Files:**
- Modify: `src/lib/components/LayoutEngine.svelte`

La prop `isRoot` se propage vers le bas uniquement si le Panel courant n'a qu'1 seul enfant. Ainsi, l'unique feuille d'un layout vide ne peut pas être fermée.

- [ ] **Step 1 : Remplacer le contenu de LayoutEngine.svelte**

```svelte
<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { isPanel } from '$lib/types';
  import type { PanelNode } from '$lib/types';
  import CodeWidget from './widgets/CodeWidget.svelte';
  import TerminalWidget from './widgets/TerminalWidget.svelte';
  import BrowserWidget from './widgets/BrowserWidget.svelte';
  import WidgetPicker from './WidgetPicker.svelte';
  import PanelOverlay from './PanelOverlay.svelte';
  import LayoutEngine from './LayoutEngine.svelte';

  let { node, isRoot = false }: { node: PanelNode; isRoot?: boolean } = $props();
</script>

{#if isPanel(node)}
  <PaneGroup direction={node.direction} class="h-full w-full">
    {#each node.children as child, i (child.id)}
      <Pane defaultSize={node.sizes[i] ?? Math.floor(100 / node.children.length)}>
        <LayoutEngine
          node={child}
          isRoot={isRoot && node.children.length === 1}
        />
      </Pane>
      {#if i < node.children.length - 1}
        <PaneResizer class="w-1 bg-border hover:bg-primary/50 transition-colors" />
      {/if}
    {/each}
  </PaneGroup>
{:else}
  <PanelOverlay nodeId={node.id} {isRoot}>
    {#if node.type === 'empty'}
      <WidgetPicker nodeId={node.id} />
    {:else if node.type === 'code'}
      <CodeWidget config={node.config} />
    {:else if node.type === 'terminal'}
      <TerminalWidget config={node.config} />
    {:else if node.type === 'browser'}
      <BrowserWidget config={node.config} />
    {/if}
  </PanelOverlay>
{/if}
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/LayoutEngine.svelte
git commit -m "feat: integrate PanelOverlay and WidgetPicker into LayoutEngine"
```

---

## Task 7 : WorkspaceCreator + mise à jour Sidebar

**Files:**
- Create: `src/lib/components/WorkspaceCreator.svelte`
- Modify: `src/lib/components/Sidebar.svelte`

- [ ] **Step 1 : Créer WorkspaceCreator.svelte**

```svelte
<script lang="ts">
  import { store } from '$lib/state.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Popover from '$lib/components/ui/popover';
  import { Plus } from '@lucide/svelte';

  let name = $state('');
  let path = $state('');
  let open = $state(false);

  async function handleCreate() {
    if (!name.trim() || !path.trim()) return;
    await store.addWorkspace(name.trim(), path.trim());
    name = '';
    path = '';
    open = false;
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" title="Nouveau workspace">
      <Plus class="h-4 w-4" />
    </Button>
  </Popover.Trigger>
  <Popover.Content class="w-72 p-4" align="start">
    <div class="flex flex-col gap-3">
      <p class="text-sm font-semibold">Nouveau workspace</p>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-muted-foreground" for="ws-name">Nom</label>
        <Input id="ws-name" bind:value={name} placeholder="Mon Projet" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-muted-foreground" for="ws-path">Chemin</label>
        <Input id="ws-path" bind:value={path} placeholder="/Users/me/mon-projet" />
      </div>
      <Button
        disabled={!name.trim() || !path.trim()}
        onclick={handleCreate}
        class="w-full"
      >
        Créer
      </Button>
    </div>
  </Popover.Content>
</Popover.Root>
```

- [ ] **Step 2 : Mettre à jour Sidebar.svelte**

Remplacer le contenu complet :

```svelte
<script lang="ts">
  import { store } from '$lib/state.svelte';
  import { FolderOpen } from '@lucide/svelte';
  import WorkspaceCreator from './WorkspaceCreator.svelte';
</script>

<aside class="flex h-full w-60 flex-shrink-0 flex-col border-r border-border bg-card">
  <div class="flex items-center gap-2 border-b border-border px-4 py-3">
    <FolderOpen class="h-4 w-4 text-muted-foreground" />
    <span class="flex-1 text-sm font-semibold">Workspaces</span>
    <WorkspaceCreator />
  </div>

  <ul class="flex-1 overflow-y-auto py-1">
    {#each store.workspaces as workspace (workspace.id)}
      <li>
        <button
          class="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors
                 hover:bg-accent hover:text-accent-foreground
                 {store.activeWorkspaceId === workspace.id
                   ? 'bg-accent text-accent-foreground font-medium'
                   : 'text-muted-foreground'}"
          onclick={() => store.setActiveWorkspace(workspace.id)}
        >
          {workspace.name}
        </button>
      </li>
    {/each}

    {#if store.workspaces.length === 0}
      <li class="px-4 py-3 text-xs text-muted-foreground">Aucun workspace</li>
    {/if}
  </ul>
</aside>
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 4 : Commit**

```bash
git add src/lib/components/WorkspaceCreator.svelte src/lib/components/Sidebar.svelte
git commit -m "feat: add WorkspaceCreator popover and update Sidebar"
```

---

## Task 8 : Raccourcis clavier dans +page.svelte

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1 : Mettre à jour +page.svelte**

Remplacer le contenu complet :

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '$lib/state.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import LayoutEngine from '$lib/components/LayoutEngine.svelte';

  onMount(async () => {
    await store.init();

    function handleKeydown(e: KeyboardEvent) {
      if (!store.activePanelId) return;
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        store.splitPanel(store.activePanelId, 'vertical');
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        store.splitPanel(store.activePanelId, 'horizontal');
      } else if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        store.closePanel(store.activePanelId);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="flex h-screen w-screen overflow-hidden bg-background text-foreground">
  <Sidebar />

  <main class="relative flex-1 overflow-hidden">
    {#if store.activeLayout}
      <LayoutEngine node={store.activeLayout.root} isRoot={true} />
    {:else}
      <div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p class="text-sm">Sélectionne un workspace dans la sidebar pour commencer.</p>
      </div>
    {/if}
  </main>
</div>
```

- [ ] **Step 2 : Lancer tous les tests**

```bash
pnpm vitest run
```

Expected : `10 tests passed` (4 layout + 6 store).

- [ ] **Step 3 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 4 : Lancer l'application**

```bash
pnpm tauri dev
```

Expected : 
- Sidebar affiche un bouton "+" en haut à droite du header
- Clic sur "+" ouvre un popover avec les champs Nom / Chemin
- Après création d'un workspace, il apparaît dans la liste
- Clic sur le workspace affiche un `WidgetPicker` au centre
- Sélection d'un widget remplace le picker
- Survol d'un widget affiche les boutons split/close en haut à droite
- `Ctrl+\` et `Ctrl+-` splitent le panneau actif
- `Ctrl+W` ferme le panneau actif

- [ ] **Step 5 : Commit final**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add keyboard shortcuts for split/close panels"
```
