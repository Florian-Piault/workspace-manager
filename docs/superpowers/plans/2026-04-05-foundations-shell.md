# Fondations & Shell UI — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer le tooling, poser les types TypeScript, le store global, SQLite et le shell UI (sidebar + layout engine récursif).

**Architecture:** Les types TypeScript servent de contrat entre le store Runes (cache mémoire réactif), la couche SQL (source de vérité) et les composants UI. Le store est un singleton instancié une fois, importé directement par les composants. Le LayoutEngine est un composant récursif qui descend l'arbre `PanelNode`.

**Tech Stack:** Tauri 2, Svelte 5 (Runes), SvelteKit, Tailwind CSS v3, shadcn-svelte, paneforge, svelte-tree-view, @lucide/svelte, @tauri-apps/plugin-sql (SQLite), vitest

---

## Structure des fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/app.css` | Créer | Directives Tailwind + variables CSS shadcn |
| `src/routes/+layout.svelte` | Créer | Import global de app.css |
| `src/lib/types.ts` | Créer | Contrat de données (Workspace, Panel, Widget…) |
| `src/lib/state.svelte.ts` | Créer | Store global singleton (Svelte 5 Runes) |
| `src/routes/+page.svelte` | Modifier | Shell principal (remplace le template greet) |
| `src/lib/components/Sidebar.svelte` | Créer | Liste des workspaces + sélection active |
| `src/lib/components/LayoutEngine.svelte` | Créer | Rendu récursif de l'arbre PanelNode |
| `src/lib/components/widgets/CodeWidget.svelte` | Créer | Placeholder widget éditeur |
| `src/lib/components/widgets/TerminalWidget.svelte` | Créer | Placeholder widget terminal |
| `src/lib/components/widgets/BrowserWidget.svelte` | Créer | Placeholder widget navigateur |
| `src-tauri/src/lib.rs` | Modifier | Brancher tauri-plugin-sql + migrations |
| `src-tauri/Cargo.toml` | Modifier | Ajouter tauri-plugin-sql |
| `src-tauri/migrations/001_initial.sql` | Créer | Schéma SQLite (workspaces, layouts, processes) |
| `vite.config.js` | Modifier | Ajouter config vitest |

---

## Task 1 : Installer et configurer Tailwind CSS v3

**Files:**
- Create: `src/app.css`
- Create: `tailwind.config.js` (généré)
- Create: `postcss.config.js` (généré)
- Create: `src/routes/+layout.svelte`

- [ ] **Step 1 : Installer les dépendances Tailwind**

```bash
pnpm add -D tailwindcss@3 postcss autoprefixer
```

Expected : résolution sans erreur, `tailwindcss@3.x.x` dans `node_modules`.

- [ ] **Step 2 : Générer la config Tailwind**

```bash
npx tailwindcss init -p
```

Expected : deux fichiers créés — `tailwind.config.js` et `postcss.config.js`.

- [ ] **Step 3 : Configurer les paths dans tailwind.config.js**

Remplacer le contenu de `tailwind.config.js` :

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 4 : Créer src/app.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5 : Créer src/routes/+layout.svelte**

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

- [ ] **Step 6 : Vérifier que Tailwind fonctionne**

```bash
pnpm dev
```

Ouvrir l'app dans le navigateur (ou Tauri). La page doit s'afficher sans erreur dans la console. Les styles Tailwind sont actifs si l'apply fonctionne (pas de FOUC).

- [ ] **Step 7 : Commit**

```bash
git add src/app.css src/routes/+layout.svelte tailwind.config.js postcss.config.js
git commit -m "feat: add Tailwind CSS v3"
```

---

## Task 2 : Initialiser shadcn-svelte

**Files:**
- Create: `components.json`
- Modify: `src/app.css` (ajout des variables CSS)
- Create: `src/lib/utils.ts` (généré par shadcn)

- [ ] **Step 1 : Lancer l'init shadcn-svelte**

```bash
pnpm dlx shadcn-svelte@latest init
```

Répondre aux questions :
- Style : **Default**
- Base color : **Slate**
- CSS variables : **Yes**
- Tailwind config path : `tailwind.config.js`
- Global CSS path : `src/app.css`
- Components alias : `$lib/components`
- Utils alias : `$lib/utils`

Expected : `components.json` créé, `src/app.css` mis à jour avec les variables CSS (`:root { --background: ... }`), `src/lib/utils.ts` créé.

- [ ] **Step 2 : Vérifier que la compilation passe**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Commit**

```bash
git add components.json src/app.css src/lib/utils.ts tailwind.config.js
git commit -m "feat: init shadcn-svelte"
```

---

## Task 3 : Installer les dépendances JS restantes

**Files:** aucun fichier à créer (packages uniquement)

- [ ] **Step 1 : Installer paneforge, svelte-tree-view, @lucide/svelte**

```bash
pnpm add paneforge svelte-tree-view @lucide/svelte @tauri-apps/plugin-sql
```

Expected : résolution sans erreur.

- [ ] **Step 2 : Vérifier la compatibilité Svelte 5**

```bash
pnpm check
```

Expected : `0 errors`. Si svelte-tree-view génère des warnings de compatibilité Svelte 4, noter l'avertissement — on isolera le composant dans une enveloppe si besoin.

- [ ] **Step 3 : Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add paneforge, svelte-tree-view, lucide, tauri-plugin-sql (js)"
```

---

## Task 4 : Configurer vitest

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1 : Installer vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2 : Ajouter la config test dans vite.config.js**

Remplacer le contenu complet de `vite.config.js` :

```js
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [sveltekit()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}));
```

- [ ] **Step 3 : Vérifier que vitest démarre**

```bash
pnpm vitest run
```

Expected : `No test files found` (pas encore de tests). Pas d'erreur de config.

- [ ] **Step 4 : Commit**

```bash
git add vite.config.js package.json pnpm-lock.yaml
git commit -m "feat: add vitest"
```

---

## Task 5 : Créer les types TypeScript

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/types.test.ts`

- [ ] **Step 1 : Écrire le test de validation des types (compile-time)**

Créer `src/lib/types.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import type { Workspace, Panel, Widget, PanelNode, Layout, WidgetType } from './types';

describe('types', () => {
  it('Widget is a valid PanelNode leaf', () => {
    const widget: Widget = {
      id: 'w1',
      type: 'code' satisfies WidgetType,
      config: { filePath: '/src/main.ts' },
    };
    const node: PanelNode = widget;
    expect(node.id).toBe('w1');
  });

  it('Panel with nested children compiles', () => {
    const leaf: Widget = { id: 'w2', type: 'terminal', config: {} };
    const panel: Panel = {
      id: 'p1',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [leaf],
    };
    const layout: Layout = {
      id: 'l1',
      workspaceId: 'ws1',
      root: panel,
    };
    expect(layout.root.children).toHaveLength(1);
  });

  it('Workspace with null layoutId is valid', () => {
    const ws: Workspace = { id: 'ws1', name: 'Mon Projet', path: '/Users/me/project', layoutId: null };
    expect(ws.layoutId).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
pnpm vitest run src/lib/types.test.ts
```

Expected : FAIL — `Cannot find module './types'`.

- [ ] **Step 3 : Créer src/lib/types.ts**

```ts
export type WidgetType = 'code' | 'terminal' | 'browser';

export interface Widget {
  id: string;
  type: WidgetType;
  config: Record<string, unknown>;
}

export interface Panel {
  id: string;
  direction: 'horizontal' | 'vertical';
  sizes: number[];        // tailles en % pour paneforge
  children: PanelNode[];
}

export type PanelNode = Panel | Widget;

export interface Layout {
  id: string;
  workspaceId: string;
  root: Panel;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  layoutId: string | null;
}

// Type guard : distingue Panel de Widget
export function isPanel(node: PanelNode): node is Panel {
  return 'children' in node;
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

```bash
pnpm vitest run src/lib/types.test.ts
```

Expected : PASS — `3 tests passed`.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts
git commit -m "feat: add TypeScript types (Workspace, Panel, Widget, Layout)"
```

---

## Task 6 : Configurer tauri-plugin-sql côté Rust

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/migrations/001_initial.sql`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1 : Ajouter tauri-plugin-sql dans Cargo.toml**

Remplacer le bloc `[dependencies]` dans `src-tauri/Cargo.toml` :

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2 : Créer le fichier de migration**

Créer `src-tauri/migrations/001_initial.sql` :

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS layouts (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  config       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS processes (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  command      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'stopped'
);
```

- [ ] **Step 3 : Mettre à jour src-tauri/src/lib.rs**

Remplacer le contenu complet :

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: include_str!("../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:workspace.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4 : Compiler le backend Rust**

```bash
cd src-tauri && cargo build 2>&1 | tail -5
```

Expected : `Finished dev [unoptimized + debuginfo] target(s)` — pas d'erreur de compilation.

- [ ] **Step 5 : Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/migrations/001_initial.sql src-tauri/src/lib.rs
git commit -m "feat: add tauri-plugin-sql with SQLite migrations"
```

---

## Task 7 : Créer le store global

**Files:**
- Create: `src/lib/state.svelte.ts`
- Create: `src/lib/state.test.ts`

- [ ] **Step 1 : Écrire le test du store**

Créer `src/lib/state.test.ts` :

```ts
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
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
pnpm vitest run src/lib/state.test.ts
```

Expected : FAIL — `Cannot find module './state.svelte.ts'`.

- [ ] **Step 3 : Créer src/lib/state.svelte.ts**

```ts
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
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

```bash
pnpm vitest run src/lib/state.test.ts
```

Expected : PASS — `3 tests passed`.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/state.svelte.ts src/lib/state.test.ts
git commit -m "feat: add WorkspaceStore (Svelte 5 Runes + SQLite)"
```

---

## Task 8 : Widget placeholders

**Files:**
- Create: `src/lib/components/widgets/CodeWidget.svelte`
- Create: `src/lib/components/widgets/TerminalWidget.svelte`
- Create: `src/lib/components/widgets/BrowserWidget.svelte`

- [ ] **Step 1 : Créer CodeWidget.svelte**

```svelte
<script lang="ts">
  let { config }: { config: Record<string, unknown> } = $props();
</script>

<div class="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground">
  <span class="text-sm">Code Editor — {JSON.stringify(config)}</span>
</div>
```

- [ ] **Step 2 : Créer TerminalWidget.svelte**

```svelte
<script lang="ts">
  let { config }: { config: Record<string, unknown> } = $props();
</script>

<div class="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground">
  <span class="text-sm">Terminal — {JSON.stringify(config)}</span>
</div>
```

- [ ] **Step 3 : Créer BrowserWidget.svelte**

```svelte
<script lang="ts">
  let { config }: { config: Record<string, unknown> } = $props();
</script>

<div class="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground">
  <span class="text-sm">Browser — {JSON.stringify(config)}</span>
</div>
```

- [ ] **Step 4 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/components/widgets/
git commit -m "feat: add widget placeholder components (Code, Terminal, Browser)"
```

---

## Task 9 : Créer LayoutEngine.svelte

**Files:**
- Create: `src/lib/components/LayoutEngine.svelte`

- [ ] **Step 1 : Créer le composant récursif**

```svelte
<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { isPanel } from '$lib/types';
  import type { PanelNode } from '$lib/types';
  import CodeWidget from './widgets/CodeWidget.svelte';
  import TerminalWidget from './widgets/TerminalWidget.svelte';
  import BrowserWidget from './widgets/BrowserWidget.svelte';

  let { node }: { node: PanelNode } = $props();
</script>

{#if isPanel(node)}
  <PaneGroup direction={node.direction} class="h-full w-full">
    {#each node.children as child, i (child.id)}
      <Pane defaultSize={node.sizes[i] ?? Math.floor(100 / node.children.length)}>
        <svelte:self node={child} />
      </Pane>
      {#if i < node.children.length - 1}
        <PaneResizer class="w-1 bg-border hover:bg-primary/50 transition-colors" />
      {/if}
    {/each}
  </PaneGroup>
{:else if node.type === 'code'}
  <CodeWidget config={node.config} />
{:else if node.type === 'terminal'}
  <TerminalWidget config={node.config} />
{:else if node.type === 'browser'}
  <BrowserWidget config={node.config} />
{/if}
```

Note : la récursivité utilise `<svelte:self node={child} />` — chaque nœud enfant est passé comme `node`, pas le nœud parent. Svelte gère nativement les composants récursifs via `svelte:self`.

- [ ] **Step 2 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/LayoutEngine.svelte
git commit -m "feat: add recursive LayoutEngine component (paneforge)"
```

---

## Task 10 : Créer Sidebar.svelte

**Files:**
- Create: `src/lib/components/Sidebar.svelte`

- [ ] **Step 1 : Créer le composant**

```svelte
<script lang="ts">
  import { store } from '$lib/state.svelte';
  import { FolderOpen } from '@lucide/svelte';
</script>

<aside class="flex h-full w-60 flex-shrink-0 flex-col border-r border-border bg-card">
  <div class="flex items-center gap-2 border-b border-border px-4 py-3">
    <FolderOpen class="h-4 w-4 text-muted-foreground" />
    <span class="text-sm font-semibold">Workspaces</span>
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

- [ ] **Step 2 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/Sidebar.svelte
git commit -m "feat: add Sidebar component with workspace list"
```

---

## Task 11 : Refactoriser +page.svelte (shell principal)

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1 : Réécrire +page.svelte**

Remplacer tout le contenu de `src/routes/+page.svelte` :

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '$lib/state.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import LayoutEngine from '$lib/components/LayoutEngine.svelte';

  onMount(async () => {
    await store.init();
  });
</script>

<div class="flex h-screen w-screen overflow-hidden bg-background text-foreground">
  <Sidebar />

  <main class="relative flex-1 overflow-hidden">
    {#if store.activeLayout}
      <LayoutEngine node={store.activeLayout.root} />
    {:else}
      <div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p class="text-sm">Sélectionne un workspace dans la sidebar pour commencer.</p>
      </div>
    {/if}
  </main>
</div>
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Lancer tous les tests**

```bash
pnpm vitest run
```

Expected : `6 tests passed` (3 types + 3 store).

- [ ] **Step 4 : Démarrer l'application**

```bash
pnpm tauri dev
```

Expected : l'app s'ouvre, affiche la sidebar vide à gauche ("Aucun workspace") et le message "Sélectionne un workspace" à droite. Pas d'erreur dans la console Tauri.

- [ ] **Step 5 : Commit final**

```bash
git add src/routes/+page.svelte
git commit -m "feat: replace greet template with workspace manager shell UI"
```
