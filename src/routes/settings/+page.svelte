<script lang="ts">
  import { theme } from '$lib/theme.svelte';
  import { settings } from '$lib/settings.svelte';
  import { Sun, Moon } from '@lucide/svelte';

  const INDENT_OPTIONS = [
    { value: 2, label: '2 espaces' },
    { value: 4, label: '4 espaces' },
    { value: 8, label: '8 espaces' },
  ] as const;

  const EDITOR_THEME_OPTIONS = [
    { value: 'oneDark', label: 'One Dark' },
    { value: 'default', label: 'Défaut (clair)' },
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

      </div>
    </section>
  </div>
</div>
