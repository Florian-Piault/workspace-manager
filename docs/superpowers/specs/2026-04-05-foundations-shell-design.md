# Design — Fondations & Shell UI

**Date :** 2026-04-05  
**Approche :** Colonne vertébrale unique (types → tooling → store + SQLite + UI en parallèle)

---

## 1. Stack Technologique

| Domaine        | Techno                          |
|----------------|---------------------------------|
| UI Components  | shadcn-svelte                   |
| Icons          | @lucide/svelte                  |
| Styling        | Tailwind CSS                    |
| Layout         | paneforge                       |
| Persistance    | tauri-plugin-sql + SQLite       |
| Code Editor    | CodeMirror 6                    |
| Terminal       | @xterm/xterm + PTY Rust         |
| Browser        | `<iframe>` (MVP)                |
| State          | Svelte 5 Runes                  |
| Sidebar Tree   | svelte-tree-view                |

---

## 2. Modèle de Données TypeScript

Fichier : `src/lib/types.ts`

```typescript
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

export type PanelNode = Panel | Widget;  // arbre récursif

export interface Layout {
  id: string;
  workspaceId: string;
  root: Panel;            // sérialisé en JSON dans SQLite
}

export interface Workspace {
  id: string;            // UUID
  name: string;
  path: string;          // chemin racine du projet
  layoutId: string | null;
}
```

`Panel` est récursif : chaque nœud est soit un split (avec des enfants), soit une feuille widget. `Layout.root` est sérialisé en JSON dans la colonne `config` de la table `layouts`.

---

## 3. Store Global (Svelte 5 Runes)

Fichier : `src/lib/state.svelte.ts`

```typescript
import type { Workspace, Layout } from './types';

export class WorkspaceStore {
  workspaces = $state<Workspace[]>([]);
  activeWorkspaceId = $state<string | null>(null);
  layouts = $state<Record<string, Layout>>({});

  activeWorkspace = $derived(
    this.workspaces.find(w => w.id === this.activeWorkspaceId) ?? null
  );

  activeLayout = $derived(
    this.activeWorkspace?.layoutId
      ? this.layouts[this.activeWorkspace.layoutId] ?? null
      : null
  );

  // Méthodes mutantes : setActiveWorkspace, addWorkspace, updateLayout
  // Chaque méthode appelle invoke() vers Tauri puis met à jour le $state
}

export const store = new WorkspaceStore();
```

Singleton exporté, importé directement par les composants. Pas de contexte Svelte, pas de store externe. SQLite est la source de vérité — le store est le cache réactif en mémoire.

---

## 4. Schéma SQLite & Commandes Tauri

### Migrations

Fichier : `src-tauri/migrations/001_initial.sql`

```sql
CREATE TABLE workspaces (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL
);

CREATE TABLE layouts (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  config       TEXT NOT NULL   -- JSON sérialisé du Panel root
);

CREATE TABLE processes (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  command      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'stopped'
);
```

### Commandes Tauri exposées au frontend

| Commande                          | Description                              |
|-----------------------------------|------------------------------------------|
| `get_workspaces`                  | Liste tous les workspaces                |
| `create_workspace(name, path)`    | INSERT + retourne le nouveau workspace   |
| `save_layout(workspace_id, json)` | UPSERT dans `layouts`                    |
| `load_layout(workspace_id)`       | SELECT + retourne le JSON de layout      |

Initialisation de la DB au démarrage via `migrate()` dans `src-tauri/src/lib.rs`.

---

## 5. Shell UI

### Structure des fichiers

```
src/
  routes/
    +page.svelte              ← shell principal
  lib/
    components/
      Sidebar.svelte          ← svelte-tree-view + liste workspaces
      LayoutEngine.svelte     ← paneforge, rendu récursif de PanelNode
      widgets/
        CodeWidget.svelte
        TerminalWidget.svelte
        BrowserWidget.svelte
    types.ts
    state.svelte.ts
```

### Layout visuel

```
┌─────────────┬────────────────────────────────┐
│             │                                │
│   Sidebar   │       LayoutEngine             │
│  (240px)    │   (paneforge / tiling)         │
│             │                                │
│ workspaces  │  ┌──────────┬──────────┐       │
│ tree-view   │  │ Widget A │ Widget B │       │
│             │  ├──────────┴──────────┤       │
│             │  │      Widget C       │       │
│             │  └────────────────────┘       │
└─────────────┴────────────────────────────────┘
```

### Comportement

- **Sidebar** : liste les workspaces, clic → `store.setActiveWorkspace(id)`. Le svelte-tree-view affiche l'arborescence de fichiers du `workspace.path` (via commande Tauri FS).
- **LayoutEngine** : composant récursif. Si le nœud courant est un `Panel` → rend un `PaneGroup` paneforge avec ses enfants. Si c'est un `Widget` → rend le composant correspondant (`CodeWidget`, `TerminalWidget`, `BrowserWidget`). La récursivité s'arrête aux feuilles.

---

## 6. Périmètre MVP (cette itération)

- Installation et configuration du tooling (Tailwind, shadcn-svelte, paneforge, svelte-tree-view, lucide)
- Types TypeScript (`types.ts`)
- Store global (`state.svelte.ts`) avec méthodes de base
- Plugin SQLite + migrations (tables workspaces, layouts, processes)
- Commandes Tauri : `get_workspaces`, `create_workspace`, `save_layout`, `load_layout`
- Shell UI : sidebar + layout engine (widgets vides pour l'instant)

Widgets fonctionnels (CodeMirror, xterm, iframe) : itération suivante.
