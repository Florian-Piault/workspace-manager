<script lang="ts">
  import { Settings, PanelLeftClose, PanelLeftOpen, FileCode, Eye } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import * as Select from '$lib/components/ui/select';
  import * as Popover from '$lib/components/ui/popover';
  import { settings } from '$lib/settings.svelte';
  import CodeEditorSettings from './CodeEditorSettings.svelte';

  const SUPPORTED_LANGUAGES = ['text', 'typescript', 'javascript', 'rust', 'json', 'markdown'];

  let {
    fileName,
    activeLang,
    loading,
    isDirty,
    isSaving,
    treeHidden,
    hasOverrides,
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
    pillControls,
    onToggleTree,
    onSetLanguageOverride,
    onSetOverride,
    onResetOverrides,
    viewMode,
    hasPreview,
    onToggleViewMode
  }: {
    fileName: string | null;
    activeLang: string;
    loading: boolean;
    isDirty: boolean;
    isSaving: boolean;
    treeHidden: boolean;
    hasOverrides: boolean;
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
    pillControls?: Snippet;
    viewMode: 'code' | 'preview';
    hasPreview: boolean;
    onToggleTree: () => void;
    onSetLanguageOverride: (lang: string) => void;
    onSetOverride: (key: keyof typeof settings.editor, value: never) => void;
    onResetOverrides: () => void;
    onToggleViewMode: () => void;
  } = $props();
</script>

<div class="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-2">
  <button
    onclick={onToggleTree}
    class="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
    title={treeHidden ? "Afficher l'arborescence" : "Masquer l'arborescence"}
  >
    {#if treeHidden}
      <PanelLeftOpen class="h-3.5 w-3.5" />
    {:else}
      <PanelLeftClose class="h-3.5 w-3.5" />
    {/if}
  </button>

  <Popover.Root>
    <Popover.Trigger
      class="flex items-center justify-center rounded p-1 transition-colors
             {hasOverrides
               ? 'text-primary hover:bg-accent'
               : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
      title="Paramètres de l'éditeur"
    >
      <Settings class="h-3.5 w-3.5" />
    </Popover.Trigger>
    <Popover.Content align="end" class="w-72 p-0">
      <CodeEditorSettings
        {effLineNumbers}
        {effWordWrap}
        {effHighlightActiveLine}
        {effAutocompletion}
        {effLint}
        {effReadOnly}
        {effFontSize}
        {effIndentUnit}
        {effEditorTheme}
        {effShowHiddenFiles}
        {effExcludePatterns}
        {hasOverrides}
        {onSetOverride}
        {onResetOverrides}
      />
    </Popover.Content>
  </Popover.Root>

  <Select.Root type="single" value={activeLang} onValueChange={v => onSetLanguageOverride(v)}>
    <Select.Trigger>{activeLang}</Select.Trigger>
    <Select.Content>
      {#each SUPPORTED_LANGUAGES as lang}
        <Select.Item value={lang} label={lang} />
      {/each}
    </Select.Content>
  </Select.Root>

  <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
    {#if fileName}
      {fileName}{isDirty ? ' ●' : ''}{isSaving ? ' …' : ''}
    {:else if loading}
      Chargement…
    {:else}
      Aucun fichier
    {/if}
  </span>

  <!-- View mode toggle: visible only when the active file has a preview renderer -->
  {#if hasPreview}
    <button
      onclick={onToggleViewMode}
      class="shrink-0 rounded p-1 transition-colors
             {viewMode === 'preview'
               ? 'bg-primary/15 text-primary hover:bg-primary/25'
               : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
      title={viewMode === 'preview' ? 'Afficher le code source' : 'Afficher la prévisualisation'}
    >
      {#if viewMode === 'preview'}
        <FileCode class="h-3.5 w-3.5" />
      {:else}
        <Eye class="h-3.5 w-3.5" />
      {/if}
    </button>
  {/if}

  {#if pillControls}
    <div class="ml-1 shrink-0 border-l border-border pl-1">
      {@render pillControls()}
    </div>
  {/if}
</div>
