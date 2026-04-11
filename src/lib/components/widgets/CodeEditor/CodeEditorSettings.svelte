<script lang="ts">
  import { settings } from '$lib/settings.svelte';

  let {
    effLineNumbers,
    effWordWrap,
    effHighlightActiveLine,
    effAutocompletion,
    effLint,
    effReadOnly,
    effFontSize,
    effIndentUnit,
    effEditorTheme,
    hasOverrides,
    onSetOverride,
    onResetOverrides
  }: {
    effLineNumbers: boolean;
    effWordWrap: boolean;
    effHighlightActiveLine: boolean;
    effAutocompletion: boolean;
    effLint: boolean;
    effReadOnly: boolean;
    effFontSize: number;
    effIndentUnit: number;
    effEditorTheme: string;
    hasOverrides: boolean;
    onSetOverride: (key: keyof typeof settings.editor, value: never) => void;
    onResetOverrides: () => void;
  } = $props();

  const toggleRows = $derived([
    { label: 'Numéros de ligne', key: 'lineNumbers' as const, value: effLineNumbers },
    { label: 'Retour à la ligne', key: 'wordWrap' as const, value: effWordWrap },
    { label: 'Ligne active surlignée', key: 'highlightActiveLine' as const, value: effHighlightActiveLine },
    { label: 'Auto-complétion', key: 'autocompletion' as const, value: effAutocompletion },
    { label: 'Lint', key: 'lint' as const, value: effLint },
    { label: 'Lecture seule', key: 'readOnly' as const, value: effReadOnly }
  ]);
</script>

<div class="flex items-center justify-between border-b border-border px-3 py-2">
  <span class="text-xs font-semibold">Paramètres de l'éditeur</span>
  {#if hasOverrides}
    <button
      class="text-xs text-muted-foreground hover:text-foreground transition-colors"
      onclick={onResetOverrides}
    >
      Réinitialiser
    </button>
  {/if}
</div>

<div class="divide-y divide-border">
  {#each toggleRows as row}
    <div class="flex items-center justify-between px-3 py-2">
      <span class="text-xs text-muted-foreground">{row.label}</span>
      <button
        role="switch"
        aria-label={row.label}
        aria-checked={row.value}
        onclick={() => onSetOverride(row.key, !row.value as never)}
        class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors
               {row.value ? 'bg-primary' : 'bg-input'}"
      >
        <span
          class="inline-block h-3 w-3 transform rounded-full bg-background shadow transition-transform
                 {row.value ? 'translate-x-3' : 'translate-x-0'}"
        ></span>
      </button>
    </div>
  {/each}

  <div class="flex items-center justify-between px-3 py-2">
    <span class="text-xs text-muted-foreground">Taille de police</span>
    <input
      type="number"
      min="10"
      max="24"
      value={effFontSize}
      oninput={e => {
        const v = parseInt((e.target as HTMLInputElement).value);
        if (v >= 10 && v <= 24) onSetOverride('fontSize', v as never);
      }}
      class="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
    />
  </div>

  <div class="flex items-center justify-between px-3 py-2">
    <span class="text-xs text-muted-foreground">Indentation</span>
    <select
      value={effIndentUnit}
      onchange={e => onSetOverride('indentUnit', parseInt((e.target as HTMLSelectElement).value) as never)}
      class="rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value={2}>2 espaces</option>
      <option value={4}>4 espaces</option>
      <option value={8}>8 espaces</option>
    </select>
  </div>

  <div class="flex items-center justify-between px-3 py-2">
    <span class="text-xs text-muted-foreground">Thème</span>
    <select
      value={effEditorTheme}
      onchange={e => onSetOverride('editorTheme', (e.target as HTMLSelectElement).value as never)}
      class="rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="oneDark">One Dark</option>
      <option value="default">Défaut</option>
    </select>
  </div>
</div>
