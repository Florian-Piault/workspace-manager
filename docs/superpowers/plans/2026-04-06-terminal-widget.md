# Terminal Widget — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le widget Terminal avec PTY Rust (`portable-pty`), streaming d'events Tauri, et frontend Xterm.js avec persistance du scrollback en SQLite.

**Architecture:** Un `PtyManager` Rust (état Tauri global) gère un `HashMap<id, PtyHandle>` de processus shells. Chaque widget démarre son shell via `pty_create`, reçoit stdout via events Tauri `pty_data:{id}`, envoie input via `pty_write`, et persiste le scrollback base64 dans `widget.config.scrollback` au destroy. Le `WorkspaceStore` reçoit une nouvelle méthode `updateWidgetConfig` pour mettre à jour le config d'un widget sans changer son type.

**Tech Stack:** Svelte 5 (Runes), Tauri 2, `portable-pty 0.8`, `base64 0.22`, `@xterm/xterm`, `@xterm/addon-fit`, vitest

---

## Structure des fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src-tauri/Cargo.toml` | Modifier | Ajouter `portable-pty`, `base64` |
| `src-tauri/src/pty.rs` | Créer | `PtyManager`, `PtyHandle`, 4 commandes Tauri |
| `src-tauri/src/lib.rs` | Modifier | `mod pty`, `manage(PtyManager::new())`, enregistrer les commandes |
| `src-tauri/capabilities/default.json` | Modifier | Ajouter `core:event:default` |
| `src/lib/layout.ts` | Modifier | Ajouter helper pur `updateNodeConfig` |
| `src/lib/layout.test.ts` | Modifier | Test TDD de `updateNodeConfig` |
| `src/lib/state.svelte.ts` | Modifier | Ajouter méthode `updateWidgetConfig` |
| `src/lib/state.test.ts` | Modifier | Test TDD de `updateWidgetConfig` |
| `src/lib/components/LayoutEngine.svelte` | Modifier | Passer `nodeId={node.id}` à `TerminalWidget` |
| `src/lib/components/widgets/TerminalWidget.svelte` | Remplacer | Implémentation complète Xterm.js |

---

## Task 1 : Dépendances Cargo

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1 : Ajouter `portable-pty` et `base64` dans Cargo.toml**

Remplacer le bloc `[dependencies]` dans `src-tauri/Cargo.toml` :

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portable-pty = "0.8"
base64 = "0.22"
```

- [ ] **Step 2 : Vérifier que cargo résout les dépendances**

```bash
cd src-tauri && cargo fetch 2>&1 | tail -5
```

Expected : pas d'erreur de résolution.

- [ ] **Step 3 : Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add portable-pty and base64 dependencies"
```

---

## Task 2 : Helper `updateNodeConfig` (TDD)

**Files:**
- Modify: `src/lib/layout.test.ts`
- Modify: `src/lib/layout.ts`

- [ ] **Step 1 : Ajouter le test dans `layout.test.ts`**

Ajouter à la fin du fichier `src/lib/layout.test.ts` :

```ts
describe('updateNodeConfig', () => {
  it('met à jour le config du widget ciblé sans changer son type ni son id', () => {
    const root = p('root', [w('w1', 'terminal')]);
    const result = updateNodeConfig(root, 'w1', { scrollback: 'abc123' });

    const widget = result.children[0] as Widget;
    expect(widget.id).toBe('w1');
    expect(widget.type).toBe('terminal');
    expect(widget.config).toEqual({ scrollback: 'abc123' });
  });

  it('ne modifie pas les autres nœuds', () => {
    const root = p('root', [w('w1', 'terminal'), w('w2', 'code')]);
    const result = updateNodeConfig(root, 'w1', { scrollback: 'xyz' });

    const other = result.children[1] as Widget;
    expect(other.config).toEqual({});
  });
});
```

Mettre à jour l'import en tête du fichier pour inclure `updateNodeConfig` :

```ts
import { describe, it, expect } from 'vitest';
import { splitPanel, closePanel, assignWidget, updateNodeConfig } from './layout';
import { isPanel } from './types';
import type { Panel, Widget, PanelNode } from './types';
```

- [ ] **Step 2 : Vérifier que les nouveaux tests échouent**

```bash
pnpm vitest run src/lib/layout.test.ts
```

Expected : FAIL — `updateNodeConfig is not a function`.

- [ ] **Step 3 : Ajouter `updateNodeConfig` dans `layout.ts`**

Ajouter à la fin de `src/lib/layout.ts` :

```ts
export function updateNodeConfig(
  root: Panel,
  targetId: string,
  config: Record<string, unknown>
): Panel {
  return mapNode(root, targetId, (node) => {
    if (isPanel(node)) return node;
    return { ...node, config };
  });
}
```

- [ ] **Step 4 : Vérifier que tous les tests de layout passent**

```bash
pnpm vitest run src/lib/layout.test.ts
```

Expected : PASS — `6 tests passed`.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/layout.ts src/lib/layout.test.ts
git commit -m "feat: add updateNodeConfig helper to layout"
```

---

## Task 3 : `updateWidgetConfig` dans WorkspaceStore (TDD)

**Files:**
- Modify: `src/lib/state.test.ts`
- Modify: `src/lib/state.svelte.ts`

- [ ] **Step 1 : Ajouter le test dans `state.test.ts`**

Ajouter dans le `describe('WorkspaceStore — layout mutations & debounce', ...)` existant, après les tests déjà présents :

```ts
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
```

- [ ] **Step 2 : Vérifier que le nouveau test échoue**

```bash
pnpm vitest run src/lib/state.test.ts
```

Expected : les 6 anciens passent, le nouveau FAIL.

- [ ] **Step 3 : Ajouter `updateWidgetConfig` dans `state.svelte.ts`**

Ajouter la méthode suivante dans la classe `WorkspaceStore`, après `closePanel` :

```ts
updateWidgetConfig(nodeId: string, config: Record<string, unknown>): void {
  const layout = this.activeLayout;
  if (!layout) return;
  const newRoot = updateNodeConfigHelper(layout.root, nodeId, config);
  this.layouts = { ...this.layouts, [layout.id]: { ...layout, root: newRoot } };
  this._debouncedSave();
}
```

Mettre à jour l'import en tête du fichier `src/lib/state.svelte.ts` :

```ts
import {
  splitPanel as splitPanelHelper,
  assignWidget as assignWidgetHelper,
  closePanel as closePanelHelper,
  updateNodeConfig as updateNodeConfigHelper,
  makeInitialRoot,
} from './layout';
```

- [ ] **Step 4 : Vérifier que tous les tests du store passent**

```bash
pnpm vitest run src/lib/state.test.ts
```

Expected : PASS — `7 tests passed`.

- [ ] **Step 5 : Vérifier la compilation TypeScript**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/state.svelte.ts src/lib/state.test.ts
git commit -m "feat: add updateWidgetConfig to WorkspaceStore"
```

---

## Task 4 : Module PTY Rust

**Files:**
- Create: `src-tauri/src/pty.rs`

- [ ] **Step 1 : Créer `src-tauri/src/pty.rs`**

```rust
use base64::{engine::general_purpose::STANDARD, Engine};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct PtyHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    _child: Box<dyn portable_pty::Child + Send + Sync>,
    scrollback: Arc<Mutex<Vec<u8>>>,
}

pub struct PtyManager(pub Mutex<HashMap<String, PtyHandle>>);

impl PtyManager {
    pub fn new() -> Self {
        PtyManager(Mutex::new(HashMap::new()))
    }
}

#[tauri::command]
pub fn pty_create(
    id: String,
    cwd: String,
    app: AppHandle,
    manager: State<PtyManager>,
) -> Result<String, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let scrollback: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));
    let scrollback_clone = Arc::clone(&scrollback);
    let event_id = id.clone();
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => {
                    let _ = app_clone.emit(&format!("pty_exit:{}", event_id), ());
                    break;
                }
                Ok(n) => {
                    let chunk = &buf[..n];
                    {
                        let mut sb = scrollback_clone.lock().unwrap();
                        sb.extend_from_slice(chunk);
                        if sb.len() > 51_200 {
                            let excess = sb.len() - 51_200;
                            sb.drain(..excess);
                        }
                    }
                    let data = String::from_utf8_lossy(chunk).to_string();
                    let _ = app_clone.emit(&format!("pty_data:{}", event_id), data);
                }
            }
        }
    });

    manager.0.lock().unwrap().insert(
        id.clone(),
        PtyHandle {
            writer,
            master: pair.master,
            _child: child,
            scrollback,
        },
    );

    Ok(id)
}

#[tauri::command]
pub fn pty_write(id: String, data: String, manager: State<PtyManager>) -> Result<(), String> {
    let mut map = manager.0.lock().unwrap();
    if let Some(handle) = map.get_mut(&id) {
        handle
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    id: String,
    cols: u16,
    rows: u16,
    manager: State<PtyManager>,
) -> Result<(), String> {
    let map = manager.0.lock().unwrap();
    if let Some(handle) = map.get(&id) {
        handle
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn pty_kill(id: String, manager: State<PtyManager>) -> Result<String, String> {
    let mut map = manager.0.lock().unwrap();
    if let Some(handle) = map.remove(&id) {
        let sb = handle.scrollback.lock().unwrap();
        Ok(STANDARD.encode(&*sb))
    } else {
        Ok(String::new())
    }
}
```

- [ ] **Step 2 : Commit**

```bash
git add src-tauri/src/pty.rs
git commit -m "feat: add Rust PTY module (portable-pty, 4 commands)"
```

---

## Task 5 : Intégrer le module PTY dans lib.rs et capabilities

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1 : Mettre à jour `src-tauri/src/lib.rs`**

Remplacer le contenu complet :

```rust
mod pty;

use pty::PtyManager;
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
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2 : Mettre à jour `src-tauri/capabilities/default.json`**

Ajouter `core:event:default` dans la liste des permissions :

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "opener:default",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select"
  ]
}
```

- [ ] **Step 3 : Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: register PTY commands and PtyManager in Tauri"
```

---

## Task 6 : Compilation Rust

**Files:** aucun (vérification uniquement)

- [ ] **Step 1 : Compiler le backend**

```bash
cd src-tauri && cargo build 2>&1 | tail -10
```

Expected : `Finished dev [unoptimized + debuginfo] target(s)` — aucune erreur.

> **Si erreur `Child + Sync` :** dans `src-tauri/src/pty.rs`, remplacer `Box<dyn portable_pty::Child + Send + Sync>` par `Box<dyn portable_pty::Child + Send>` dans la définition de `PtyHandle`.

- [ ] **Step 2 : Commit (si modification)**

Si une correction a été nécessaire :

```bash
git add src-tauri/src/pty.rs
git commit -m "fix: remove Sync bound on Child in PtyHandle"
```

---

## Task 7 : Dépendances npm

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1 : Installer Xterm.js**

```bash
pnpm add @xterm/xterm @xterm/addon-fit
```

Expected : résolution sans erreur.

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add @xterm/xterm and @xterm/addon-fit"
```

---

## Task 8 : Mettre à jour LayoutEngine

**Files:**
- Modify: `src/lib/components/LayoutEngine.svelte`

TerminalWidget a besoin de son `nodeId` pour créer et identifier son PTY. Le seul changement est de passer `nodeId={node.id}` pour le terminal.

- [ ] **Step 1 : Mettre à jour la ligne TerminalWidget dans LayoutEngine.svelte**

Remplacer :

```svelte
    {:else if node.type === 'terminal'}
      <TerminalWidget config={node.config} />
```

Par :

```svelte
    {:else if node.type === 'terminal'}
      <TerminalWidget config={node.config} nodeId={node.id} />
```

- [ ] **Step 2 : Vérifier la compilation**

```bash
pnpm check
```

Expected : `0 errors` (TerminalWidget n'a pas encore la prop nodeId, donc une erreur TypeScript est attendue — elle sera résolue à la Task 9).

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/LayoutEngine.svelte
git commit -m "feat: pass nodeId to TerminalWidget in LayoutEngine"
```

---

## Task 9 : Implémenter TerminalWidget.svelte

**Files:**
- Replace: `src/lib/components/widgets/TerminalWidget.svelte`

- [ ] **Step 1 : Remplacer le contenu de TerminalWidget.svelte**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { store } from '$lib/state.svelte';
  import '@xterm/xterm/css/xterm.css';

  let { config, nodeId }: { config: Record<string, unknown>; nodeId: string } = $props();

  let container: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let ptyId: string | null = $state(null);
  let exited = $state(false);
  let error = $state<string | null>(null);

  let unlistenData: (() => void) | null = null;
  let unlistenExit: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;

  async function startPty(targetId: string) {
    const cwd = store.activeWorkspace?.path ?? '/';

    try {
      ptyId = await invoke<string>('pty_create', { id: targetId, cwd });
    } catch (err) {
      error = String(err);
      return;
    }

    unlistenData = await listen<string>(`pty_data:${ptyId}`, (event) => {
      terminal.write(event.payload);
    });

    unlistenExit = await listen(`pty_exit:${ptyId}`, () => {
      exited = true;
    });
  }

  onMount(async () => {
    terminal = new Terminal({
      theme: {
        background: '#0f0f0f',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#3a3a3a',
      },
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      cursorBlink: true,
      allowTransparency: false,
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    // Restaurer le scrollback persisté
    if (config.scrollback && typeof config.scrollback === 'string') {
      const binary = atob(config.scrollback as string);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      terminal.write(bytes);
    }

    await startPty(nodeId);

    terminal.onData((data) => {
      if (!ptyId) return;
      invoke('pty_write', { id: ptyId, data }).catch(() => {});
    });

    resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ptyId) {
        invoke('pty_resize', { id: ptyId, cols: terminal.cols, rows: terminal.rows }).catch(() => {});
      }
    });
    resizeObserver.observe(container);
  });

  onDestroy(async () => {
    resizeObserver?.disconnect();
    unlistenData?.();
    unlistenExit?.();
    if (ptyId) {
      try {
        const scrollback = await invoke<string>('pty_kill', { id: ptyId });
        if (scrollback) {
          store.updateWidgetConfig(nodeId, { scrollback });
        }
      } catch {
        // ignorer les erreurs à la fermeture
      }
    }
    terminal?.dispose();
  });

  async function restart() {
    exited = false;
    error = null;
    unlistenData?.();
    unlistenExit?.();
    unlistenData = null;
    unlistenExit = null;
    terminal.clear();
    await startPty(nodeId + '_' + Date.now());
    if (ptyId) {
      invoke('pty_resize', { id: ptyId, cols: terminal.cols, rows: terminal.rows }).catch(() => {});
    }
  }
</script>

<div class="relative h-full w-full overflow-hidden bg-[#0f0f0f]">
  <div bind:this={container} class="h-full w-full p-1" />

  {#if error}
    <div class="absolute inset-0 flex items-center justify-center bg-black/70">
      <div class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/50 bg-card p-6">
        <p class="text-center text-sm text-destructive">Impossible de démarrer le shell :</p>
        <code class="text-center text-xs text-muted-foreground">{error}</code>
        <button
          class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onclick={restart}
        >
          Réessayer
        </button>
      </div>
    </div>
  {:else if exited}
    <div class="absolute inset-0 flex items-center justify-center bg-black/60">
      <div class="flex flex-col items-center gap-3">
        <span class="text-sm text-muted-foreground">Processus terminé.</span>
        <button
          class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onclick={restart}
        >
          Relancer
        </button>
      </div>
    </div>
  {/if}
</div>
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
pnpm check
```

Expected : `0 errors`.

- [ ] **Step 3 : Lancer tous les tests Vitest**

```bash
pnpm vitest run
```

Expected : `11 tests passed` (4 layout + 7 store).

- [ ] **Step 4 : Commit**

```bash
git add src/lib/components/widgets/TerminalWidget.svelte
git commit -m "feat: implement TerminalWidget with xterm.js and PTY backend"
```

---

## Task 10 : Smoke test

**Files:** aucun

- [ ] **Step 1 : Lancer l'application**

```bash
pnpm tauri dev
```

- [ ] **Step 2 : Scénario de test manuel**

Effectuer les actions suivantes dans l'ordre :

1. Créer un workspace avec un chemin valide (ex: `/Users/piflorian/Labs`)
2. Cliquer sur le workspace → le `WidgetPicker` apparaît
3. Cliquer "Terminal" → le terminal démarre avec le prompt shell
4. Taper `ls` → la liste des fichiers du workspace s'affiche
5. Taper `pwd` → le chemin retourné correspond au `path` du workspace
6. Splitter le panneau (`Ctrl+\`) → cliquer "Terminal" dans le nouveau panneau → deux shells indépendants
7. Fermer l'application et relancer → le terminal restaure le scrollback (les sorties précédentes s'affichent)

Expected : tout fonctionne sans erreur dans la console Tauri/WebView.

- [ ] **Step 3 : Commit final si tout est bon**

```bash
git add -A
git commit -m "feat: Phase 3 terminal widget complete (portable-pty + xterm.js)"
```
