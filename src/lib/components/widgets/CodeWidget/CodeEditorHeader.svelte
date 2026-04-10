<script lang="ts">
  import { Settings } from '@lucide/svelte';
  import * as Select from '$lib/components/ui/select';
  import * as Popover from '$lib/components/ui/popover';
  import { settings } from '$lib/settings.svelte';
  import CodeEditorSettings from './CodeEditorSettings.svelte';

  const SUPPORTED_LANGUAGES = ['text', 'typescript', 'javascript', 'rust', 'json', 'markdown'];

  let {
    fileName,
    activeLang,
    loading,
    saving,
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
    onOpenFile,
    onSetLanguageOverride,
    onSetOverride,
    onResetOverrides
  }: {
    fileName: string | null;
    activeLang: string;
    loading: boolean;
    saving: boolean;
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
    onOpenFile: () => void;
    onSetLanguageOverride: (lang: string) => void;
    onSetOverride: (key: keyof typeof settings.editor, value: never) => void;
    onResetOverrides: () => void;
  } = $props();
</script>

<div class="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-2">
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

  <button
    class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    onclick={onOpenFile}
    disabled={loading}
  >
    Ouvrir
  </button>

  <span class="flex-1 truncate text-xs text-muted-foreground">
    {fileName ?? 'Aucun fichier'}
  </span>

  {#if saving}
    <span class="text-xs text-muted-foreground/60">Sauvegarde…</span>
  {/if}

  {#if loading}
    <span class="text-xs text-muted-foreground/60">Chargement…</span>
  {/if}
</div>
