# Spec : WidgetPill contraste & écran blanc workspace vide

Date : 2026-04-06

## Contexte

Deux bugs visuels/fonctionnels identifiés :

1. La `WidgetPill` est invisible sur les widgets à fond sombre (terminal, code) car elle utilise `bg-background/70` — en dark mode, cette couleur se confond avec le contenu derrière.
2. Un workspace dont le layout a `root.children = []` (état corrompu persisté en DB, ou état post-fermeture) affiche un écran blanc au lieu d'un fallback utilisable.

---

## Bug 1 — WidgetPill : fond neutre forcé

**Fichier :** `src/lib/components/widgets/WidgetPill.svelte`

### Changement

Remplacer le fond semi-transparent dépendant du thème par un fond sombre fixe, toujours contrasté quelle que soit la couleur du widget derrière.

**Conteneur principal :**
```diff
- bg-background/70 border-border/50
+ bg-black/60 border-white/10
```

**Icônes de type (Terminal, Code2, Globe) :**
```diff
- text-muted-foreground
+ text-white/60
```

**Bouton label (rename) :**
```diff
- text-muted-foreground hover:text-foreground
+ text-white/70 hover:text-white
```

**Séparateur vertical :**
```diff
- bg-border/50
+ bg-white/20
```

**Boutons actions (split, close) :**
```diff
- text-muted-foreground hover:bg-accent hover:text-accent-foreground
+ text-white/70 hover:bg-white/15 hover:text-white
```

L'effet `backdrop-blur-sm` est conservé pour maintenir l'esthétique "verre dépoli".

---

## Bug 2 — Écran blanc sur workspace vide

### A. Guard dans `LayoutEngine.svelte`

**Fichier :** `src/lib/components/LayoutEngine.svelte`

Ajouter une branche de fallback quand `isPanel(node)` mais `node.children.length === 0` : afficher un `WidgetPicker` à la place du `PaneGroup` vide.

```svelte
{#if isPanel(node)}
  {#if node.children.length === 0}
    <WidgetPicker nodeId={node.id} />
  {:else}
    <PaneGroup ...>...</PaneGroup>
  {/if}
{:else}
  ...
{/if}
```

Cela couvre les layouts corrompus déjà en DB et tout état invalide futur.

### B. Protection dans `layout.ts`

**Fichier :** `src/lib/layout.ts`

Dans `closePanel`, si le résultat de `removeNode` produit un root avec `children.length === 0`, retourner `makeInitialRoot()` plutôt qu'un Panel vide. Cela évite de persister un état invalide.

```ts
export function closePanel(root: Panel, targetId: string): Panel {
  const result = removeNode(root, targetId);
  if (result.children.length === 0) {
    return makeInitialRoot();
  }
  return result;
}
```

L'utilisateur retrouve un `WidgetPicker` au lieu d'un blanc.

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/lib/components/widgets/WidgetPill.svelte` | Classes CSS fond/texte/icônes |
| `src/lib/components/LayoutEngine.svelte` | Guard `children.length === 0` |
| `src/lib/layout.ts` | `closePanel` → fallback `makeInitialRoot()` |

## Critères d'acceptation

- La WidgetPill est visible au survol sur un terminal (fond noir), un code editor (fond sombre) et un browser (fond blanc).
- Un workspace avec `root.children = []` en DB affiche le WidgetPicker au lieu d'un écran blanc.
- Fermer tous les panels d'un workspace recrée automatiquement un root avec un empty widget.
