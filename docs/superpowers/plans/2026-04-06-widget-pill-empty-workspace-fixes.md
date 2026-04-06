# WidgetPill Contraste & Écran Blanc Workspace Vide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger deux bugs visuels/fonctionnels : la WidgetPill invisible sur fond sombre, et l'écran blanc quand un workspace a un layout vide.

**Architecture:** Trois fichiers touchés indépendamment — CSS dans `WidgetPill.svelte`, guard visuel dans `LayoutEngine.svelte`, et protection logique dans `layout.ts` (avec test unitaire existant à étendre).

**Tech Stack:** Svelte 5, TypeScript, Tailwind CSS, Vitest

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/lib/layout.ts` | Logique de manipulation du layout (closePanel) |
| `src/lib/layout.test.ts` | Tests unitaires de layout (à étendre) |
| `src/lib/components/LayoutEngine.svelte` | Rendu récursif des panels et widgets |
| `src/lib/components/widgets/WidgetPill.svelte` | Pill flottante au survol d'un widget |

---

## Task 1 : Protéger `closePanel` contre un root vide

**Files:**
- Modify: `src/lib/layout.ts`
- Test: `src/lib/layout.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans le `describe('closePanel', ...)` existant de `src/lib/layout.test.ts` :

```typescript
it('recrée un root initial si le dernier enfant direct du root est supprimé', () => {
  const root = p('root', [w('only')]);
  const result = closePanel(root, 'only');

  expect(result.children).toHaveLength(1);
  const child = result.children[0] as Widget;
  expect(child.type).toBe('empty');
  // Le root est nouveau (different id car makeInitialRoot génère un UUID)
  expect(result.id).not.toBe('root');
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
npx vitest run src/lib/layout.test.ts
```

Attendu : FAIL sur le nouveau test — `result.children` serait vide `[]`.

- [ ] **Step 3 : Implémenter la protection dans `closePanel`**

Dans `src/lib/layout.ts`, remplacer :

```typescript
export function closePanel(root: Panel, targetId: string): Panel {
  return removeNode(root, targetId);
}
```

Par :

```typescript
export function closePanel(root: Panel, targetId: string): Panel {
  const result = removeNode(root, targetId);
  if (result.children.length === 0) {
    return makeInitialRoot();
  }
  return result;
}
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/lib/layout.test.ts
```

Attendu : tous les tests PASS, y compris les anciens (`removes target and keeps sibling`, `collapses parent when only 1 child remains after removal`).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/layout.ts src/lib/layout.test.ts
git commit -m "fix: closePanel recrée un root initial si tous les enfants sont fermés"
```

---

## Task 2 : Guard visuel dans `LayoutEngine` pour root vide

**Files:**
- Modify: `src/lib/components/LayoutEngine.svelte`

> Note : Ce guard est défensif — il couvre les layouts corrompus déjà persistés en DB que la Task 1 ne peut pas rattraper rétroactivement.

- [ ] **Step 1 : Modifier le branchement dans `LayoutEngine.svelte`**

Dans `src/lib/components/LayoutEngine.svelte`, remplacer :

```svelte
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
        <PaneResizer class="{node.direction === 'horizontal' ? 'w-1' : 'h-1'} bg-border hover:bg-primary/50 transition-colors" />
      {/if}
    {/each}
  </PaneGroup>
```

Par :

```svelte
{#if isPanel(node)}
  {#if node.children.length === 0}
    <WidgetPicker nodeId={node.id} />
  {:else}
    <PaneGroup direction={node.direction} class="h-full w-full">
      {#each node.children as child, i (child.id)}
        <Pane defaultSize={node.sizes[i] ?? Math.floor(100 / node.children.length)}>
          <LayoutEngine
            node={child}
            isRoot={isRoot && node.children.length === 1}
          />
        </Pane>
        {#if i < node.children.length - 1}
          <PaneResizer class="{node.direction === 'horizontal' ? 'w-1' : 'h-1'} bg-border hover:bg-primary/50 transition-colors" />
        {/if}
      {/each}
    </PaneGroup>
  {/if}
```

- [ ] **Step 2 : Vérifier le typage**

```bash
npm run check
```

Attendu : aucune erreur TypeScript/Svelte.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/components/LayoutEngine.svelte
git commit -m "fix: afficher WidgetPicker si le root du layout n'a aucun enfant"
```

---

## Task 3 : WidgetPill — fond toujours contrasté

**Files:**
- Modify: `src/lib/components/widgets/WidgetPill.svelte`

- [ ] **Step 1 : Mettre à jour les classes CSS de la pill**

Dans `src/lib/components/widgets/WidgetPill.svelte`, remplacer le contenu complet du `<div>` racine et de ses enfants par le suivant (diff annoté) :

**Conteneur principal** (ligne 37-41) — remplacer :
```svelte
<div
  class="absolute right-1 top-1 z-10 flex items-center gap-0.5
         rounded-md bg-background/70 px-1.5 py-0.5 backdrop-blur-sm
         opacity-0 transition-opacity group-hover:opacity-100 border border-border/50"
>
```
Par :
```svelte
<div
  class="absolute right-1 top-1 z-10 flex items-center gap-0.5
         rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm
         opacity-0 transition-opacity group-hover:opacity-100 border border-white/10"
>
```

**Icônes de type** (Terminal, Code2, Globe) — remplacer `text-muted-foreground` par `text-white/60` sur les 3 icônes :
```svelte
<Terminal class="h-3 w-3 text-white/60 flex-shrink-0" />
```
```svelte
<Code2 class="h-3 w-3 text-white/60 flex-shrink-0" />
```
```svelte
<Globe class="h-3 w-3 text-white/60 flex-shrink-0" />
```

**Bouton label (rename)** — remplacer :
```svelte
class="max-w-[80px] truncate text-xs text-muted-foreground hover:text-foreground"
```
Par :
```svelte
class="max-w-[80px] truncate text-xs text-white/70 hover:text-white"
```

**Séparateur vertical** — remplacer :
```svelte
<div class="mx-0.5 h-3 w-px bg-border/50"></div>
```
Par :
```svelte
<div class="mx-0.5 h-3 w-px bg-white/20"></div>
```

**Boutons actions** (split horizontal, split vertical, fermer) — remplacer `text-muted-foreground hover:bg-accent hover:text-accent-foreground` par `text-white/70 hover:bg-white/15 hover:text-white` sur les 3 boutons :
```svelte
class="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white"
```
Le bouton close garde son `disabled:pointer-events-none disabled:opacity-30` :
```svelte
class="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white
       disabled:pointer-events-none disabled:opacity-30"
```

- [ ] **Step 2 : Vérifier le typage**

```bash
npm run check
```

Attendu : aucune erreur.

- [ ] **Step 3 : Vérification visuelle**

Lancer l'app (`npm run dev` ou `npm run tauri dev`) et vérifier que :
- La pill est visible au survol sur un widget terminal (fond noir)
- La pill est visible au survol sur un widget browser (fond blanc/clair)
- La pill est visible au survol sur un widget code editor (fond sombre)

- [ ] **Step 4 : Commit**

```bash
git add src/lib/components/widgets/WidgetPill.svelte
git commit -m "fix: WidgetPill fond sombre fixe pour contraste sur tous les widgets"
```
