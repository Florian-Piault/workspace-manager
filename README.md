# Workspace Manager

Application **bureau** pour regrouper projets et outils dans des **workspaces** : mise en page en **panneaux redimensionnables**, **widgets** (navigateur, éditeur de code, terminal) et **persistance** locale via SQLite.

## Fonctionnalités

- **Workspaces** liés à un dossier sur disque, gestion depuis une barre latérale.
- **Grille de panneaux** (split horizontal / vertical, fermeture) avec raccourcis clavier (`⌘/Ctrl+\`, `⌘/Ctrl+-`, `⌘/Ctrl+W` sur le panneau actif).
- **Widgets** : navigateur intégré, éditeur (CodeMirror : JS, JSON, Markdown, Rust…), terminal (PTY côté Tauri).
- **Données** stockées dans une base SQLite embarquée (`workspace.db`).

## Stack technique

| Couche   | Technologies |
|----------|---------------|
| UI       | [SvelteKit](https://kit.svelte.dev/) 2, [Svelte](https://svelte.dev/) 5, [Tailwind CSS](https://tailwindcss.com/) |
| Bureau   | [Tauri](https://tauri.app/) 2 (Rust) |
| Éditeur  | [CodeMirror](https://codemirror.net/) 6 |
| Terminal | [xterm.js](https://xtermjs.org/) |

## Prérequis

- [Node.js](https://nodejs.org/) et [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) et les outils système Tauri ([prérequis plateforme](https://v2.tauri.app/start/prerequisites/))

## Développement

```bash
pnpm install
pnpm tauri dev
```

Le frontend Vite écoute sur le port **1420** (voir `tauri.conf.json`).

Pour certains environnements (HMR sur la machine ou dev mobile Tauri), la variable d’environnement `TAURI_DEV_HOST` peut être nécessaire : voir la configuration Vite du projet et la documentation Tauri.

## Qualité / build

```bash
pnpm check              # svelte-check + sync
pnpm build              # build statique SvelteKit
pnpm exec vitest run    # tests Vitest (fichiers *.test.ts)
```

## Licence

MIT
