# Phase 2 — Layout Dynamique & Création de Workspace

## Résumé

Rendre le layout interactif : l'utilisateur peut splitter, fermer et assigner des widgets aux panneaux, créer des workspaces depuis la sidebar. Le layout est auto-sauvegardé dans SQLite après chaque modification (debounce 1s).

---

## 1. Architecture & Mutations de l'arbre

Le layout est un arbre `PanelNode` (Panel | Widget). Les mutations sont des helpers purs dans `state.svelte.ts`.

### Nouveau type

`'empty'` est ajouté à `WidgetType` — état intermédiaire d'un panneau nouvellement créé, affiche le `WidgetPicker`.

### 4 helpers de mutation

| Fonction | Effet |
|---|---|
| `splitPanel(nodeId, direction)` | Remplace le nœud par un `Panel` contenant l'ancien nœud + un `EmptyWidget` |
| `assignWidget(nodeId, type)` | Remplace un `EmptyWidget` par un `Widget` du type choisi |
| `closePanel(nodeId)` | Supprime le nœud ; si le parent n'a plus qu'1 enfant, le parent est remplacé par cet enfant |
| `debouncedSave()` | Sérialise l'arbre et écrit dans SQLite — appelé automatiquement après chaque mutation |

**Cas limite :** `closePanel` n'est jamais appelé sur la racine — le bouton est désactivé quand le nœud n'a pas de parent. `LayoutEngine` passe une prop `isRoot` au nœud du premier niveau.

Tous les helpers mutent `store.activeLayout` et déclenchent `debouncedSave()`.

---

## 2. Composants

### `PanelOverlay.svelte`
Surcouche invisible sur chaque panneau feuille, visible au survol. Affiche 3 boutons en coin supérieur droit :
- `SplitHorizontal` → `splitPanel(id, 'horizontal')`
- `SplitVertical` → `splitPanel(id, 'vertical')`
- `X` (close) → `closePanel(id)` — désactivé si le nœud est la racine (prop `isRoot`)

### `WidgetPicker.svelte`
Affiché quand `node.type === 'empty'`. Liste verticale, icône à gauche :
- `[Code2]` Code Editor
- `[Terminal]` Terminal
- `[Globe]` Browser

Clic → `store.assignWidget(nodeId, type)`.

### `WorkspaceCreator.svelte`
Popover attaché au bouton `+` en haut de la sidebar. Champs :
- `Nom` (text input)
- `Chemin` (text input, path manuel)

Bouton "Créer" → `store.addWorkspace(name, path)` + fermeture auto.

### `LayoutEngine.svelte` (modification)
- Wrap chaque nœud feuille dans `PanelOverlay`
- Rend `WidgetPicker` si `node.type === 'empty'`
- Un clic sur un panneau → `store.setActivePanel(nodeId)`

### `Sidebar.svelte` (modification)
- Ajouter le bouton `+` en haut avec `WorkspaceCreator` en popover

---

## 3. État actif & Raccourcis clavier

Nouveau champ `activePanelId = $state<string | null>(null)` dans `WorkspaceStore`.

`setActivePanel(id)` appelé au clic sur un panneau — highlight de bordure via classe CSS.

Listener `keydown` sur `window` dans `+page.svelte` :

| Raccourci | Action |
|---|---|
| `Ctrl+\` | `splitPanel(activePanelId, 'vertical')` |
| `Ctrl+-` | `splitPanel(activePanelId, 'horizontal')` |
| `Ctrl+W` | `closePanel(activePanelId)` |

---

## 4. Sauvegarde auto (debounce)

Après chaque mutation, `debouncedSave()` est appelé. Implémentation via `setTimeout` / `clearTimeout` dans le store. Délai : 1000ms.

Conditions : `activeWorkspaceId !== null` et `db !== null`. Sinon, sauvegarde ignorée silencieusement.

---

## 5. Tests

### `src/lib/layout.test.ts` (nouveau)
Helpers testés isolément (fonctions pures) :
- `splitPanel` → produit un `Panel` avec 2 enfants dont un `EmptyWidget`
- `closePanel` → remonte l'enfant restant si parent avec 1 enfant
- `closePanel` sur racine → remplace par `EmptyWidget`
- `assignWidget` → remplace `EmptyWidget` par le bon `WidgetType`

### `src/lib/state.test.ts` (extension)
- Après `splitPanel`, `saveLayout` est appelé après 1s (`vi.useFakeTimers`)
- Appels multiples rapides → un seul `saveLayout` (debounce)

---

## 6. Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `src/lib/types.ts` | Ajouter `'empty'` à `WidgetType` |
| `src/lib/state.svelte.ts` | Ajouter `activePanelId`, `splitPanel`, `assignWidget`, `closePanel`, `setActivePanel`, `debouncedSave` |
| `src/lib/layout.test.ts` | Créer — tests des helpers purs |
| `src/lib/state.test.ts` | Étendre — tests debounce |
| `src/lib/components/PanelOverlay.svelte` | Créer |
| `src/lib/components/WidgetPicker.svelte` | Créer |
| `src/lib/components/WorkspaceCreator.svelte` | Créer |
| `src/lib/components/LayoutEngine.svelte` | Modifier |
| `src/lib/components/Sidebar.svelte` | Modifier |
| `src/routes/+page.svelte` | Modifier — raccourcis clavier |
