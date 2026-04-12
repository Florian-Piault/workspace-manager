---
name: Palette Cmd/Ctrl+P
overview: Ajouter une palette de recherche globale (raccourci Mod+P configurable) listant les workspaces et les widgets, avec filtrage texte et actions alignées sur la sidebar (changer de workspace ou activer un panneau).
todos:
  - id: settings-keybind
    content: Ajouter quickSwitch à KeybindSettings, KEYBIND_DEFAULTS et UI réglages
    status: done
  - id: quick-switch-component
    content: Créer QuickSwitchPalette.svelte (UI, filtre, actions store + goto)
    status: done
  - id: layout-mount
    content: Monter la palette dans +layout.svelte et valider z-index au-dessus des overlays
    status: done
  - id: verify-check
    content: Exécuter pnpm check et tests manuels des raccourcis
    status: done
---

# Palette rapide Mod+P (workspaces + panneaux)

## Contexte technique existant

- Le store expose [`setActiveWorkspace`](src/lib/state.svelte.ts) (réinitialise `activePanelId`) et [`setActivePanel`](src/lib/state.svelte.ts).
- La sidebar reproduit déjà le comportement cible : pour un widget, `setActiveWorkspace` + `setActivePanel` + `goto('/')` si besoin ([`SidebarWorkspaceItem.svelte`](src/lib/components/SidebarWorkspaceItem.svelte)).
- Les widgets affichables sont obtenus via [`flatWidgets`](src/lib/layout.ts) (feuilles non vides uniquement) ; le libellé affiché est `widget.label ?? store.autoLabels.get(widget.id) ?? widget.type` (même fichier sidebar).
- Les raccourcis globaux utilisent `window` en `capture: true` et `settings.keybinds` — voir [`Sidebar.svelte`](src/lib/components/Sidebar.svelte) (toggle sidebar) et [`+page.svelte`](src/routes/+page.svelte) (split/close panel).
- L’overlay maximisé est en `z-40` ([`+page.svelte`](src/routes/+page.svelte)) : la palette devra être **au-dessus** (ex. `z-50` ou plus).

## Comportement fonctionnel

| Action                     | Effet                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mod+raccourci (défaut `p`) | Ouvre la palette ; `preventDefault` pour éviter l’impression navigateur                                                                                 |
| Saisie                     | Filtre les entrées (sous-chaîne insensible à la casse sur nom workspace / libellé widget)                                                               |
| Entrée workspace           | `store.setActiveWorkspace(id)` puis `goto('/')` si pas déjà sur `/`                                                                                     |
| Entrée widget              | `store.setActiveWorkspace(activeWorkspaceId)` (no-op si déjà actif), `store.setActivePanel(widgetId)`, `goto('/')` si besoin — cohérent avec la sidebar |
| Échap                      | Ferme la palette                                                                                                                                        |
| Portée widgets             | Uniquement le **workspace actif** (si aucun workspace actif, section widgets vide ou message court)                                                     |

Les emplacements vides restent exclus (comme `flatWidgets` aujourd’hui), sauf demande ultérieure.

## Implémentation proposée

### 1. Réglages et raccourci

- Étendre [`KeybindSettings`](src/lib/settings.svelte.ts) avec une clé dédiée, ex. `quickSwitch: 'p'`, dans `KEYBIND_DEFAULTS`.
- Ajouter l’entrée dans [`KEYBIND_LABELS` / page réglages](src/routes/settings/+page.svelte) (catégorie « Interface »).
- Vérifier que `p` n’entre pas en conflit avec [`BLOCKED_KEYS`](src/lib/settings.svelte.ts) (actuellement `p` n’est pas bloqué — OK).

### 2. Composant `QuickSwitchPalette.svelte` (nouveau)

- État local : `open`, `query`, index de sélection pour clavier.
- UI : overlay plein écran semi-transparent + panneau centré (style cohérent avec [`popover-content`](src/lib/components/ui/popover/popover-content.svelte) : `bg-popover`, bordure, ombre).
- Champ de recherche auto-focus à l’ouverture ; liste en deux groupes titrés (« Workspaces », « Panneaux » ou libellés FR alignés sur le produit).
- Dérivés : workspaces depuis `store.workspaces` ; widgets depuis `store.activeLayout` → `flatWidgets(root)` avec libellé identique à la sidebar (factoriser une petite fonction utilitaire locale ou dans [`layout.ts`](src/lib/layout.ts) si réutilisation évidente, ex. `getWidgetDisplayName(widget, autoLabels)`).
- Raccourci : `onMount` → `keydown` capture sur `window`, Mod + touche configurée, `if (open && Escape) close`, navigation flèches / Enter si temps le permet (sinon MVP : clic souris + Enter sur ligne sélectionnée simple).
- **Ne pas** ouvrir la palette si l’événement vient d’un champ où Mod+P a un sens critique — en pratique ici on intercepte volontairement comme les autres raccourcis app ; si besoin minimal : ignorer si `target` est `INPUT`/`TEXTAREA` **et** ce n’est pas la palette (peut être omis pour coller à VS Code où Cmd+P fonctionne partout).

### 3. Intégration layout

- Importer et monter le composant dans [`+layout.svelte`](src/routes/+layout.svelte) (à côté de `Sidebar`) pour disponibilité sur `/` et `/settings`.

### 4. Vérification manuelle

- `pnpm check` après implémentation.
- Tester : ouverture/fermeture, sélection workspace, sélection widget avec workspace déjà actif, depuis page principale et page paramètres.

## Fichiers principaux touchés

- Nouveau : [`src/lib/components/QuickSwitchPalette.svelte`](src/lib/components/QuickSwitchPalette.svelte)
- [`src/lib/settings.svelte.ts`](src/lib/settings.svelte.ts) — types + défauts
- [`src/routes/settings/+page.svelte`](src/routes/settings/+page.svelte) — libellés keybind
- [`src/routes/+layout.svelte`](src/routes/+layout.svelte) — montage du composant
