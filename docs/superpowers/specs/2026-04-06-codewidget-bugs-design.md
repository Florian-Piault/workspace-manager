# CodeWidget — Correction de bugs (2026-04-06)

## Contexte

Deux bugs distincts affectent `CodeWidget` :

1. **Le `nodeId` n'est pas transmis** depuis `LayoutEngine.svelte`, ce qui empêche le store de mettre à jour `config.filePath` après l'ouverture d'un fichier. Conséquences en cascade : placeholder permanent, "Aucun fichier" dans le header, langue bloquée sur "text", éditeur inaccessible (overlay couvre les interactions).

2. **Le sélecteur de langue chevauche `WidgetPill`** car les deux occupent le coin supérieur droit du widget (`WidgetPill` est `absolute right-1 top-1 z-10`).

## Corrections

### 1. `src/lib/components/LayoutEngine.svelte` — ligne 38

Ajouter `nodeId={node.id}` à `<CodeWidget>` :

```svelte
<CodeWidget config={node.config} nodeId={node.id} />
```

### 2. `src/lib/components/widgets/CodeWidget.svelte` — header

Déplacer le `<select>` de langue en première position dans la barre d'outils (extrême gauche), avant le bouton "Ouvrir".

Ordre résultant :
```
[select langue] · [Ouvrir] · [nom fichier flex-1] · [Sauvegarde…] · [Chargement…]
```

Le sélecteur s'éloigne ainsi de la zone couverte par `WidgetPill`, et la lecture gauche→droite (contexte → action → état) reste cohérente.

## Fichiers modifiés

- `src/lib/components/LayoutEngine.svelte`
- `src/lib/components/widgets/CodeWidget.svelte`

## Tests de validation

- Ouvrir un fichier → le nom s'affiche dans le header, le placeholder disparaît, l'éditeur est interactif
- La langue se met à jour automatiquement selon l'extension du fichier
- Au survol du widget, la `WidgetPill` n'est plus superposée avec le sélecteur
- La sauvegarde automatique fonctionne (indicateur "Sauvegarde…" visible)
