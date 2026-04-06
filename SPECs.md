# PRD - Workspace Manager (Tauri + Svelte 5)

## 1. Vision du Produit

Une application de productivité centralisée permettant aux développeurs de regrouper leurs outils (éditeur, terminal, doc) au sein de workspaces persistants, gérés par un backend Rust performant (Tauri) et une interface fluide utilisant les Runes de Svelte 5.

---

## 2. Spécifications Fonctionnelles

### A. Gestion des Workspaces (Sidebar - Zone Verte)

- **Treeview :** Navigation hiérarchique au sein des projets.
- **Persistance :** Sauvegarde de l'arborescence et de l'état (ouvert/fermé) des dossiers.
- **Contextualisation :** Le changement de workspace dans la sidebar met à jour dynamiquement le layout central

### B. Moteur de Layout (Zone Bleue)

- **Composant :** Utilisation de `Resizable` (shadcn-svelte / paneforge).
- **Mode :** Tiling (colonnes et lignes ajustables).
- **Dynamisme :** Ajout/suppression de panneaux à la volée.

### C. Catalogue de Widgets

- **Widget Code :** Instance de CodeMirror 6 (performant et léger).
- **Widget Terminal :** Shell via PTY backend (intégration `portable-pty` en Rust).
- **Widget Browser :** Rendu via `<iframe>` pour la V1 (migration Webview prévue).

---

## 3. Architecture Technique

### A. Frontend : Svelte 5 (Runes)

- **État réactif :** Utilisation de `$state` pour la structure des workspaces et `$derived` pour les vues filtrées.
- **Communication :** Utilisation de `invoke` pour les appels système et `listen` pour les flux de données asynchrones (logs terminal).

### B. Backend : Rust & Tauri

- **Stockage :** SQLite (`tauri-plugin-sql`) pour la persistance locale.
- **Process Management :** Gestion du cycle de vie des serveurs (spawn, kill, restart) via `tokio::process`.
- **FS :** Accès sécurisé au système de fichiers via le plugin `fs` de Tauri.

---

## 4. Modèle de Données (Svelte Store)

```typescript
// state.svelte.ts
export class WorkspaceState {
  workspaces = $state<Workspace[]>([]);
  activeWorkspaceId = $state<string | null>(null);

  // Retourne le layout du workspace actif
  activeLayout = $derived(
    this.workspaces.find(w => w.id === this.activeWorkspaceId)?.layout ?? null
  );

  constructor() {
    // Initialisation via SQLite
  }
}
```

## 5. Schéma de Base de Données (SQLite)

| Table          | Colonnes                                                            | Description                                       |
| :------------- | :------------------------------------------------------------------ | :------------------------------------------------ |
| **Workspaces** | `id (UUID)`, `name (TEXT)`, `path (TEXT)`                           | Entité racine du projet et chemin racine.         |
| **Layouts**    | `id (UUID)`, `workspace_id (FK)`, `config (JSON)`                   | Sérialisation de l'état des panneaux `Resizable`. |
| **Processes**  | `id (UUID)`, `workspace_id (FK)`, `command (TEXT)`, `status (TEXT)` | Registre des serveurs et processus à persister.   |

## 6. Roadmap MVP

1. **Phase 1 : Fondations & Persistance**
   - Initialisation du projet Tauri avec Svelte 5.
   - Configuration de `tauri-plugin-sql` et création des migrations SQLite (Table Workspaces).
   - Création du store global avec les Runes `$state` pour la gestion des données.

2. **Phase 2 : Interface & Layout Dynamique**
   - Intégration de `shadcn-svelte` et du composant `Resizable`.
   - Implémentation de la logique de split (colonnes/lignes) récursive.
   - Système de sauvegarde automatique du JSON de layout dans SQLite.

3. **Phase 3 : Core Widgets**
   - **Éditeur :** Intégration de CodeMirror 6 avec lecture/écriture via le backend Rust.
   - **Terminal :** Setup du backend PTY en Rust et liaison avec un composant frontend (Xterm.js).
   - **Browser :** Implémentation de la vue `<iframe>` avec gestion basique d'historique.

4. **Phase 4 : Gestion des Processus & Finitions**
   - Interface de contrôle pour lancer/arrêter des serveurs (scripts npm, serveurs Go/Rust).
   - Système de logs en temps réel via events Tauri.
   - Optimisation de l'UX (Drag & Drop, raccourcis clavier).
