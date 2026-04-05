# Terminal Widget — Design Spec

**Date :** 2026-04-05  
**Phase :** 3 — Core Widgets (Terminal)  
**Stack :** Tauri 2, Svelte 5 (Runes), `portable-pty`, Xterm.js

---

## 1. Objectif

Implémenter un widget Terminal fonctionnel dans le layout manager. Chaque widget Terminal possède son propre processus shell indépendant (PTY), détecte le shell par défaut de l'utilisateur, démarre dans le répertoire du workspace, et restaure le scrollback à la réouverture de l'application.

---

## 2. Architecture

```
Frontend (Svelte)          Backend (Rust/Tauri)
─────────────────          ────────────────────
TerminalWidget.svelte      PtyManager (Mutex<HashMap<id, PtyHandle>>)
  └── xterm.js Terminal      └── PtyHandle
        │                          ├── PtyPair (portable-pty)
        │  invoke("pty_write")     ├── child process (shell)
        ├──────────────────────>   ├── reader thread (tokio::spawn)
        │                          └── scrollback buffer (Vec<u8>, max 50Ko)
        │  event("pty_data:{id}")
        <──────────────────────────┘
        │
        │  invoke("pty_resize")
        ├──────────────────────>  pty.resize(cols, rows)
        │
        │  invoke("pty_kill")
        ├──────────────────────>  kill + cleanup + persist scrollback
        │
        │  invoke("pty_create")
        ├──────────────────────>  spawn shell, return ptyId
```

**Gestion d'état Rust :** `PtyManager` est stocké via `app.manage()`. Chaque `PtyHandle` contient le PTY, le processus enfant, et un buffer scrollback accumulé.

**Gestion d'état Svelte :** `TerminalWidget` est auto-contenu — gère son propre cycle de vie dans `onMount`/`onDestroy`. Le `WorkspaceStore` n'est pas impliqué dans la gestion PTY.

---

## 3. Backend Rust

### 3.1 Dépendances (`src-tauri/Cargo.toml`)

```toml
portable-pty = "0.8"
tokio = { version = "1", features = ["full"] }
```

### 3.2 Commandes Tauri

| Commande | Paramètres | Retour | Description |
|---|---|---|---|
| `pty_create` | `widget_id: String, cwd: String` | `Result<String>` | Spawn shell + démarrage thread lecteur |
| `pty_write` | `id: String, data: String` | `Result<()>` | Envoie input au PTY |
| `pty_resize` | `id: String, cols: u16, rows: u16` | `Result<()>` | Redimensionne le PTY |
| `pty_kill` | `id: String` | `Result<String>` | Kill shell + retourne scrollback base64 + cleanup |

### 3.3 Détection du shell

```rust
std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
```

### 3.4 Thread lecteur

Un `tokio::spawn` par PTY lit stdout en boucle et émet `app.emit("pty_data:{id}", chunk)`. À la fermeture du processus, émet `app.emit("pty_exit:{id}", ())`.

### 3.5 Persistance du scrollback

À `pty_kill`, le buffer scrollback (max 50Ko, bytes bruts ANSI) est encodé en base64 et retourné par la commande (`Result<String>`). Le frontend met à jour `widget.config.scrollback` via `store.updateWidgetConfig(nodeId, { scrollback })` — une nouvelle méthode à ajouter au `WorkspaceStore` qui met à jour le champ `config` d'un widget sans changer son type, puis déclenche un `_debouncedSave()`.

Pas de nouvelle table SQLite — le scrollback est stocké dans `layouts.config` (champ JSON `scrollback` du widget).

---

## 4. Frontend Svelte

### 4.1 Dépendances npm

```bash
pnpm add @xterm/xterm @xterm/addon-fit
```

### 4.2 Fichiers

| Fichier | Action |
|---|---|
| `src/lib/components/widgets/TerminalWidget.svelte` | Remplacer le placeholder |

### 4.3 Cycle de vie de `TerminalWidget.svelte`

**`onMount` :**
1. Créer un `Terminal` xterm.js avec thème shadcn (variables CSS).
2. Attacher au container DOM via `terminal.open(el)`.
3. Invoquer `pty_create(widget.id, workspace.path)` → reçoit `ptyId`.
4. Si `widget.config.scrollback` existe, écrire dans xterm avant le premier prompt.
5. Souscrire à `pty_data:{ptyId}` via `listen()` → `terminal.write(data)`.
6. Souscrire à `pty_exit:{ptyId}` → afficher overlay "Processus terminé. [Relancer]".
7. `terminal.onData(data => invoke("pty_write", { id: ptyId, data }))`.
8. `ResizeObserver` → `fitAddon.fit()` → `invoke("pty_resize", { id: ptyId, cols, rows })`.

**`onDestroy` :**
1. `unlisten()` pour les deux events.
2. `invoke("pty_kill", { id: ptyId })`.
3. `terminal.dispose()`.

### 4.4 Thème xterm

```ts
const theme = {
  background: getCSSVar('--background'),
  foreground: getCSSVar('--foreground'),
  cursor:     getCSSVar('--primary'),
}
```

`getCSSVar` lit `getComputedStyle(document.documentElement).getPropertyValue(name)`.

### 4.5 Restauration du scrollback

Le `config` du widget (déjà dans le layout SQLite) contient `{ scrollback?: string }` (base64). Aucune nouvelle structure de données ni migration.

---

## 5. Gestion des erreurs

| Scénario | Comportement |
|---|---|
| `pty_create` échoue (shell introuvable, CWD invalide) | Widget affiche message d'erreur inline |
| Shell se termine normalement | Event `pty_exit:{id}` → overlay "Processus terminé. [Relancer]" |
| `pty_write` sur PTY mort | Ignoré silencieusement côté Rust |
| Scrollback > 50Ko | Tronqué aux 50Ko les plus récents |

---

## 6. Tests

| Test | Type | Outil |
|---|---|---|
| `parseScrollback(config)` extrait le scrollback | Unitaire | Vitest |
| Compilation frontend sans erreurs | Compilation | `pnpm check` |
| Compilation backend sans erreurs | Compilation | `cargo build` |
| Smoke test manuel : créer un terminal, taper `ls`, fermer, rouvrir | Manuel | `pnpm tauri dev` |

---

## 7. Hors scope (V1)

- Sélection/copie avancée (xterm gère nativement)
- Tabs ou sessions multiples dans un même widget
- Reconnexion automatique si le shell crash
- Support Windows (portable-pty le supporte, mais non testé)
