<script lang="ts">
  import { settings } from '$lib/settings.svelte';
  import EditorSettingsFields from './EditorSettingsFields.svelte';
  import type { EditorDefaults } from '$lib/settings.svelte';

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
    effShowHiddenFiles,
    effExcludePatterns,
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
    effShowHiddenFiles: boolean;
    effExcludePatterns: string[];
    hasOverrides: boolean;
    onSetOverride: (key: keyof EditorDefaults, value: never) => void;
    onResetOverrides: () => void;
  } = $props();

  const values = $derived({
    lineNumbers: effLineNumbers,
    wordWrap: effWordWrap,
    highlightActiveLine: effHighlightActiveLine,
    autocompletion: effAutocompletion,
    lint: effLint,
    readOnly: effReadOnly,
    fontSize: effFontSize,
    indentUnit: effIndentUnit as 2 | 4 | 8,
    editorTheme: effEditorTheme as 'oneDark' | 'default',
    showHiddenFiles: effShowHiddenFiles,
    excludePatterns: effExcludePatterns,
    autoSaveDelay: settings.editor.autoSaveDelay,
  });
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
  <EditorSettingsFields
    {values}
    onchange={(key, value) => onSetOverride(key, value as never)}
    compact={true}
  />
</div>
