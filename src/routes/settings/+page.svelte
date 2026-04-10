<script lang="ts">
  import { theme } from '$lib/theme.svelte';
  import { settings, TERMINAL_COLOR_PRESETS, KEYBIND_DEFAULTS, BLOCKED_KEYS, type KeybindSettings } from '$lib/settings.svelte';
  import { Sun, Moon, RotateCcw, AlertTriangle, Keyboard } from '@lucide/svelte';

  type KeybindKey = keyof KeybindSettings;

  const KEYBIND_LABELS: Record<KeybindKey, { label: string; description: string; category: 'Interface' | 'Widget / Éditeur' }> = {
    splitHorizontal: { label: 'Split horizontal', description: 'Divise le panel actif en deux colonnes', category: 'Interface' },
    splitVertical:   { label: 'Split vertical',   description: 'Divise le panel actif en deux lignes', category: 'Interface' },
    closePanel:      { label: 'Fermer le panel',   description: 'Ferme le panel actif', category: 'Interface' },
    toggleSidebar:   { label: 'Afficher/masquer la sidebar', description: 'Bascule la visibilité de la barre latérale', category: 'Interface' },
    saveFile:        { label: 'Sauvegarder le fichier', description: 'Enregistre le fichier ouvert dans l\'éditeur', category: 'Widget / Éditeur' },
  };

  // Action Svelte pour focus automatique sans autofocus HTML
  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  // Touche en cours de capture
  let capturing = $state<KeybindKey | null>(null);
  let captureError = $state<string | null>(null);

  function formatKey(key: string) {
    if (key === '\\') return 'Backslash';
    if (key === '-') return '-';
    return key.toUpperCase();
  }

  // Retourne la liste des conflits pour une touche donnée (en excluant la clé elle-même)
  function findConflicts(selfKey: KeybindKey, key: string): string[] {
    return (Object.keys(settings.keybinds) as KeybindKey[])
      .filter(k => k !== selfKey && settings.keybinds[k] === key)
      .map(k => KEYBIND_LABELS[k].label);
  }

  function startCapture(key: KeybindKey) {
    capturing = key;
    captureError = null;
  }

  function handleCaptureKeydown(e: KeyboardEvent) {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      capturing = null;
      captureError = null;
      return;
    }

    // Ignorer les touches modificatrices seules
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return;

    const normalizedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (BLOCKED_KEYS.has(normalizedKey)) {
      captureError = `La combinaison Mod+${formatKey(normalizedKey)} est réservée et ne peut pas être assignée.`;
      return;
    }

    settings.setKeybinds({ [capturing]: normalizedKey });
    capturing = null;
    captureError = null;
  }

  const INDENT_OPTIONS = [
    { value: 2, label: '2 espaces' },
    { value: 4, label: '4 espaces' },
    { value: 8, label: '8 espaces' },
  ] as const;

  const EDITOR_THEME_OPTIONS = [
    { value: 'oneDark', label: 'One Dark' },
    { value: 'default', label: 'Défaut (clair)' },
  ] as const;

  const TERMINAL_PRESET_OPTIONS = [
    { value: 'dark', label: 'Dark (défaut)' },
    { value: 'solarizedDark', label: 'Solarized Dark' },
    { value: 'light', label: 'Light' },
  ] as const;

  const CURSOR_STYLE_OPTIONS = [
    { value: 'block', label: 'Bloc' },
    { value: 'bar', label: 'Barre' },
    { value: 'underline', label: 'Souligné' },
  ] as const;

  const AUTOSAVE_OPTIONS = [
    { value: 0, label: 'Désactivée' },
    { value: 500, label: '500 ms' },
    { value: 1000, label: '1 s (défaut)' },
    { value: 2000, label: '2 s' },
    { value: 5000, label: '5 s' },
    { value: 10000, label: '10 s' },
  ] as const;
</script>

{#snippet toggle(checked: boolean, label: string, onchange: (v: boolean) => void)}
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onclick={() => onchange(!checked)}
    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
           {checked ? 'bg-primary' : 'bg-input'}"
  >
    <span
      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition-transform
             {checked ? 'translate-x-4' : 'translate-x-0'}"
    ></span>
  </button>
{/snippet}

<div class="h-full overflow-auto">
  <div class="mx-auto max-w-2xl px-8 py-10">
    <h1 class="mb-10 text-xl font-semibold">Paramètres</h1>

    <!-- Section : Apparence -->
    <section class="mb-10">
      <h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Apparence
      </h2>
      <div class="rounded-lg border border-border bg-card">
        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Thème</p>
            <p class="text-xs text-muted-foreground">Mode clair ou sombre</p>
          </div>
          <button
            class="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onclick={theme.toggle}
          >
            {#if theme.dark}
              <Moon class="h-3.5 w-3.5" /><span>Sombre</span>
            {:else}
              <Sun class="h-3.5 w-3.5" /><span>Clair</span>
            {/if}
          </button>
        </div>
      </div>
    </section>

    <!-- Section : Général -->
    <section class="mb-10">
      <h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Général
      </h2>
      <div class="divide-y divide-border rounded-lg border border-border bg-card">

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Position de la sidebar</p>
            <p class="text-xs text-muted-foreground">Côté gauche ou droit de la fenêtre</p>
          </div>
          <div class="flex overflow-hidden rounded-md border border-border">
            <button
              onclick={() => settings.setGeneral({ sidebarPosition: 'left' })}
              class="px-3 py-1 text-sm transition-colors
                     {settings.general.sidebarPosition === 'left'
                       ? 'bg-primary text-primary-foreground'
                       : 'bg-background text-foreground hover:bg-accent'}"
            >Gauche</button>
            <button
              onclick={() => settings.setGeneral({ sidebarPosition: 'right' })}
              class="border-l border-border px-3 py-1 text-sm transition-colors
                     {settings.general.sidebarPosition === 'right'
                       ? 'bg-primary text-primary-foreground'
                       : 'bg-background text-foreground hover:bg-accent'}"
            >Droite</button>
          </div>
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Rouvrir le dernier workspace</p>
            <p class="text-xs text-muted-foreground">Restaure automatiquement le workspace actif au démarrage</p>
          </div>
          {@render toggle(settings.general.reopenLastWorkspace, 'Rouvrir le dernier workspace', (v) => settings.setGeneral({ reopenLastWorkspace: v }))}
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Confirmer la fermeture d'un workspace</p>
            <p class="text-xs text-muted-foreground">Demande une confirmation avant de fermer</p>
          </div>
          {@render toggle(settings.general.confirmCloseWorkspace, 'Confirmer fermeture workspace', (v) => settings.setGeneral({ confirmCloseWorkspace: v }))}
        </div>

      </div>
    </section>

    <!-- Section : Terminal -->
    <section class="mb-10">
      <h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Terminal
      </h2>
      <div class="divide-y divide-border rounded-lg border border-border bg-card">

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Taille de police</p>
            <p class="text-xs text-muted-foreground">En pixels (10–24)</p>
          </div>
          <input
            type="number"
            min="10"
            max="24"
            value={settings.terminal.fontSize}
            oninput={(e) => {
              const v = parseInt((e.target as HTMLInputElement).value);
              if (v >= 10 && v <= 24) settings.setTerminal({ fontSize: v });
            }}
            class="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Type de curseur</p>
            <p class="text-xs text-muted-foreground">Forme du curseur dans le terminal</p>
          </div>
          <select
            value={settings.terminal.cursorStyle}
            onchange={(e) => settings.setTerminal({ cursorStyle: (e.target as HTMLSelectElement).value as 'block' | 'bar' | 'underline' })}
            class="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {#each CURSOR_STYLE_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Curseur clignotant</p>
            <p class="text-xs text-muted-foreground">Animation du curseur dans le terminal</p>
          </div>
          {@render toggle(settings.terminal.cursorBlink, 'Curseur clignotant', (v) => settings.setTerminal({ cursorBlink: v }))}
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Thème de couleurs</p>
            <p class="text-xs text-muted-foreground">Palette de couleurs du terminal</p>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="h-4 w-4 rounded-full border border-border"
              style="background: {TERMINAL_COLOR_PRESETS[settings.terminal.colorPreset].background}"
            ></span>
            <select
              value={settings.terminal.colorPreset}
              onchange={(e) => settings.setTerminal({ colorPreset: (e.target as HTMLSelectElement).value as 'dark' | 'solarizedDark' | 'light' })}
              class="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {#each TERMINAL_PRESET_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

      </div>
    </section>

    <!-- Section : Navigateur -->
    <section class="mb-10">
      <h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Navigateur
      </h2>
      <div class="rounded-lg border border-border bg-card">
        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">URL par défaut</p>
            <p class="text-xs text-muted-foreground">Chargée à l'ouverture d'un nouveau widget navigateur</p>
          </div>
          <input
            type="url"
            value={settings.browser.defaultUrl}
            onchange={(e) => settings.setBrowser({ defaultUrl: (e.target as HTMLInputElement).value })}
            placeholder="https://..."
            class="w-52 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </section>

    <!-- Section : Éditeur de code -->
    <section class="mb-10">
      <h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Éditeur de code
      </h2>
      <div class="divide-y divide-border rounded-lg border border-border bg-card">

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Numéros de ligne</p>
            <p class="text-xs text-muted-foreground">Affiche les numéros à gauche de l'éditeur</p>
          </div>
          {@render toggle(settings.editor.lineNumbers, 'Numéros de ligne', (v) => settings.setEditor({ lineNumbers: v }))}
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Retour à la ligne automatique</p>
            <p class="text-xs text-muted-foreground">Wrap le texte long sans défilement horizontal</p>
          </div>
          {@render toggle(settings.editor.wordWrap, 'Retour à la ligne', (v) => settings.setEditor({ wordWrap: v }))}
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Surligner la ligne active</p>
            <p class="text-xs text-muted-foreground">Met en évidence la ligne où se trouve le curseur</p>
          </div>
          {@render toggle(settings.editor.highlightActiveLine, 'Surligner la ligne active', (v) => settings.setEditor({ highlightActiveLine: v }))}
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Auto-complétion</p>
            <p class="text-xs text-muted-foreground">Suggestions de complétion pendant la saisie</p>
          </div>
          {@render toggle(settings.editor.autocompletion, 'Auto-complétion', (v) => settings.setEditor({ autocompletion: v }))}
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Lint</p>
            <p class="text-xs text-muted-foreground">Indique les erreurs et avertissements dans la gouttière</p>
          </div>
          {@render toggle(settings.editor.lint, 'Lint', (v) => settings.setEditor({ lint: v }))}
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Lecture seule</p>
            <p class="text-xs text-muted-foreground">Désactive l'édition dans tous les éditeurs</p>
          </div>
          {@render toggle(settings.editor.readOnly, 'Lecture seule', (v) => settings.setEditor({ readOnly: v }))}
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Taille de police</p>
            <p class="text-xs text-muted-foreground">En pixels (10–24)</p>
          </div>
          <input
            type="number"
            min="10"
            max="24"
            value={settings.editor.fontSize}
            oninput={(e) => {
              const v = parseInt((e.target as HTMLInputElement).value);
              if (v >= 10 && v <= 24) settings.setEditor({ fontSize: v });
            }}
            class="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Indentation</p>
            <p class="text-xs text-muted-foreground">Nombre d'espaces par niveau</p>
          </div>
          <select
            value={settings.editor.indentUnit}
            onchange={(e) => settings.setEditor({ indentUnit: parseInt((e.target as HTMLSelectElement).value) as 2 | 4 | 8 })}
            class="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {#each INDENT_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Thème de l'éditeur</p>
            <p class="text-xs text-muted-foreground">Coloration syntaxique</p>
          </div>
          <select
            value={settings.editor.editorTheme}
            onchange={(e) => settings.setEditor({ editorTheme: (e.target as HTMLSelectElement).value as 'oneDark' | 'default' })}
            class="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {#each EDITOR_THEME_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>

        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="text-sm font-medium">Délai de sauvegarde automatique</p>
            <p class="text-xs text-muted-foreground">0 = désactivée, sinon délai en millisecondes après la dernière frappe</p>
          </div>
          <select
            value={settings.editor.autoSaveDelay}
            onchange={(e) => settings.setEditor({ autoSaveDelay: parseInt((e.target as HTMLSelectElement).value) })}
            class="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {#each AUTOSAVE_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>

      </div>
    </section>

    <!-- Section : Raccourcis clavier -->
    <section class="mb-10">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Raccourcis clavier
        </h2>
        <button
          onclick={() => settings.resetKeybinds()}
          class="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RotateCcw class="h-3 w-3" />
          Réinitialiser
        </button>
      </div>

      {#if captureError}
        <div class="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
          {captureError}
        </div>
      {/if}

      {#each (['Interface', 'Widget / Éditeur'] as const) as category}
        {@const entries = (Object.keys(KEYBIND_LABELS) as KeybindKey[]).filter(k => KEYBIND_LABELS[k].category === category)}
        <div class="mb-6">
          <p class="mb-2 text-xs font-medium text-muted-foreground">{category}</p>
          <div class="divide-y divide-border rounded-lg border border-border bg-card">
            {#each entries as key}
              {@const meta = KEYBIND_LABELS[key]}
              {@const currentKey = settings.keybinds[key]}
              {@const conflicts = findConflicts(key, currentKey)}
              {@const isCapturing = capturing === key}
              <div class="flex items-center justify-between px-4 py-3">
                <div>
                  <p class="text-sm font-medium">{meta.label}</p>
                  <p class="text-xs text-muted-foreground">{meta.description}</p>
                  {#if conflicts.length > 0}
                    <p class="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle class="h-3 w-3" />
                      Conflit avec : {conflicts.join(', ')}
                    </p>
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  {#if isCapturing}
                    <button
                      class="min-w-32 rounded-md border-2 border-primary bg-primary/10 px-3 py-1 text-center text-xs font-mono text-primary focus:outline-none animate-pulse"
                      onkeydown={handleCaptureKeydown}
                      onblur={() => { capturing = null; captureError = null; }}
                      use:focusOnMount
                    >
                      Appuyez sur une touche…
                    </button>
                  {:else}
                    <button
                      onclick={() => startCapture(key)}
                      class="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Keyboard class="h-3 w-3" />
                      <kbd class="font-mono">Mod+{formatKey(currentKey)}</kbd>
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </section>
  </div>
</div>
