<script lang="ts">
  import { X } from '@lucide/svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Input } from '$lib/components/ui/input';
  import type { EditorDefaults } from '$lib/settings.svelte';

  type Values = Pick<EditorDefaults,
    | 'lineNumbers' | 'wordWrap' | 'highlightActiveLine'
    | 'autocompletion' | 'lint' | 'readOnly'
    | 'fontSize' | 'indentUnit' | 'editorTheme'
    | 'showHiddenFiles' | 'excludePatterns'
  >;

  let {
    values,
    onchange,
    compact = false,
  }: {
    values: Values;
    onchange: <K extends keyof Values>(key: K, value: Values[K]) => void;
    compact?: boolean;
  } = $props();

  const px = $derived(compact ? 'px-3 py-2' : 'px-4 py-3');
  const labelClass = $derived(compact ? 'text-xs text-muted-foreground' : 'text-sm font-medium');
  const descClass = 'text-xs text-muted-foreground';

  const toggleRows: { label: string; desc?: string; key: keyof Pick<Values, 'lineNumbers' | 'wordWrap' | 'highlightActiveLine' | 'autocompletion' | 'lint' | 'readOnly' | 'showHiddenFiles'> }[] = [
    { label: 'Numéros de ligne', key: 'lineNumbers' },
    { label: 'Retour à la ligne', key: 'wordWrap' },
    { label: 'Ligne active surlignée', key: 'highlightActiveLine' },
    { label: 'Auto-complétion', key: 'autocompletion' },
    { label: 'Lint', key: 'lint' },
    { label: 'Lecture seule', key: 'readOnly' },
    { label: 'Fichiers cachés', desc: 'Affiche les fichiers commençant par .', key: 'showHiddenFiles' },
  ];

  let newPattern = $state('');

  function addPattern() {
    const val = newPattern.trim();
    if (!val || values.excludePatterns.includes(val)) return;
    onchange('excludePatterns', [...values.excludePatterns, val]);
    newPattern = '';
  }

  function removePattern(pattern: string) {
    onchange('excludePatterns', values.excludePatterns.filter(p => p !== pattern));
  }
</script>

{#each toggleRows as row}
  <div class="flex items-center justify-between {px}">
    <div>
      <p class={labelClass}>{row.label}</p>
      {#if row.desc && !compact}
        <p class={descClass}>{row.desc}</p>
      {/if}
    </div>
    <button
      role="switch"
      aria-label={row.label}
      aria-checked={values[row.key]}
      onclick={() => onchange(row.key, !values[row.key] as never)}
      class="relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors
             {compact ? 'h-4 w-7' : 'h-5 w-9'}
             {values[row.key] ? 'bg-primary' : 'bg-input'}"
    >
      <span
        class="inline-block transform rounded-full bg-background shadow transition-transform
               {compact ? 'h-3 w-3' : 'h-4 w-4'}
               {values[row.key] ? (compact ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0'}"
      ></span>
    </button>
  </div>
{/each}

<!-- Font size -->
<div class="flex items-center justify-between {px}">
  <p class={labelClass}>Taille de police</p>
  <input
    type="number" min="10" max="24"
    value={values.fontSize}
    oninput={e => {
      const v = parseInt((e.target as HTMLInputElement).value);
      if (v >= 10 && v <= 24) onchange('fontSize', v);
    }}
    class="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
  />
</div>

<!-- Indent -->
<div class="flex items-center justify-between {px}">
  <p class={labelClass}>Indentation</p>
  <select
    value={values.indentUnit}
    onchange={e => onchange('indentUnit', parseInt((e.target as HTMLSelectElement).value) as 2 | 4 | 8)}
    class="rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
  >
    <option value={2}>2 espaces</option>
    <option value={4}>4 espaces</option>
    <option value={8}>8 espaces</option>
  </select>
</div>

<!-- Theme -->
<div class="flex items-center justify-between {px}">
  <p class={labelClass}>Thème</p>
  <select
    value={values.editorTheme}
    onchange={e => onchange('editorTheme', (e.target as HTMLSelectElement).value as 'oneDark' | 'default')}
    class="rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
  >
    <option value="oneDark">One Dark</option>
    <option value="default">Défaut</option>
  </select>
</div>

<!-- Exclude patterns -->
<div class="{px} {compact ? '' : 'space-y-2'}">
  <p class="{labelClass} {compact ? 'mb-1.5' : 'mb-2'}">Dossiers exclus</p>
  <div class="flex flex-wrap gap-1.5 mb-2">
    {#each values.excludePatterns as pattern (pattern)}
      <Badge variant="secondary" class="gap-1 pr-1 text-xs font-mono">
        {pattern}
        <button
          onclick={() => removePattern(pattern)}
          class="ml-0.5 rounded-full hover:bg-muted-foreground/20 transition-colors"
          aria-label="Supprimer {pattern}"
        >
          <X class="h-3 w-3" />
        </button>
      </Badge>
    {/each}
  </div>
  <div class="flex gap-1.5">
    <Input
      bind:value={newPattern}
      placeholder="Ajouter un pattern…"
      class="h-7 text-xs font-mono"
      onkeydown={e => { if (e.key === 'Enter') { e.preventDefault(); addPattern(); } }}
    />
    <button
      onclick={addPattern}
      class="rounded border border-border bg-background px-2 py-1 text-xs transition-colors hover:bg-accent"
    >
      +
    </button>
  </div>
</div>
