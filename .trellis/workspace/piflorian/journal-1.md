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
