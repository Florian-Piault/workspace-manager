# Journal - piflorian (Part 1)

> AI development session journal
> Started: 2026-04-07

---



## Session 1: Bootstrap guidelines frontend

**Date**: 2026-04-07
**Task**: Bootstrap guidelines frontend

### Summary

(Add summary)

### Main Changes

Remplissage des 6 fichiers de guidelines frontend à partir de l'analyse du code existant.

| Fichier | Contenu |
|---------|---------|
| `directory-structure.md` | Arborescence `src/`, règles de nommage, rôle de chaque couche |
| `component-guidelines.md` | Svelte 5 runes, `$props()`, `Snippet`, Tailwind, shadcn/lucide |
| `state-management.md` | `WorkspaceStore` singleton, `$state`/`$derived`, updates immutables, debounce |
| `type-safety.md` | Types dans `types.ts`, type guards, interdits (`any`, `@ts-ignore`) |
| `hook-guidelines.md` | Pas de hooks React — `onMount`, fonctions pures `utils/`, `layout.ts` |
| `quality-guidelines.md` | `npm run check`, Vitest, mocks Tauri, patterns interdits, checklist PR |

**Stack documentée** : SvelteKit + Svelte 5 runes + Tauri + Tailwind + shadcn/bits-ui + Vitest


### Git Commits

| Hash | Message |
|------|---------|
| `98a6b9f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: fix: terminal espace + browser barre + traffic lights + drag fenêtre

**Date**: 2026-04-08
**Task**: fix: terminal espace + browser barre + traffic lights + drag fenêtre

### Summary

(Add summary)

### Main Changes

| Domaine | Description |
|---------|-------------|
| Terminal | Fix espace intercepté par PanelOverlay (`e.target !== e.currentTarget`) |
| Browser | `decorations: false` — supprime la barre native macOS, corrige le positionnement du child webview |
| Browser | Loading indicator (Loader spinner dans l'URL bar) + rotation 1/4 tour du bouton refresh |
| Sidebar | Boutons traffic lights macOS (rouge/jaune/vert) avec icônes X/Minus/Maximize2 au hover |
| Sidebar | Boutons Windows 11 (rectangulaires, rouge sur close) avec détection de plateforme |
| Sidebar | Collapsed = layout vertical des boutons |
| Sidebar | macOS fullscreen via `setFullscreen()` au lieu de `toggleMaximize()` |
| Sidebar | Drag fenêtre via `startDragging()` explicite (spacer en expanded, header en collapsed) |
| Capabilities | `allow-close`, `allow-minimize`, `allow-toggle-maximize`, `allow-set-fullscreen`, `allow-start-dragging` |

**Fichiers modifiés** :
- `src/lib/components/PanelOverlay.svelte` — fix espace
- `src/lib/components/Sidebar.svelte` — traffic lights + drag
- `src/lib/components/widgets/BrowserWidget.svelte` — loading + refresh rotation
- `src-tauri/tauri.conf.json` — decorations: false
- `src-tauri/capabilities/default.json` — permissions fenêtre

**En attente** : commit par le développeur après validation


### Git Commits

(No commits - planning session)

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
