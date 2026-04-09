<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  // CodeMirror core
  import {
    EditorView,
    keymap,
    drawSelection,
    dropCursor,
    crosshairCursor,
    highlightSpecialChars,
    rectangularSelection,
    highlightActiveLine as cmHighlightActiveLine,
    lineNumbers as cmLineNumbers
  } from '@codemirror/view';
  import { EditorState, Compartment } from '@codemirror/state';
  import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
  import {
    foldGutter,
    indentOnInput,
    syntaxHighlighting,
    defaultHighlightStyle,
    bracketMatching,
    foldKeymap,
    indentUnit
  } from '@codemirror/language';
  import {
    autocompletion as cmAutocompletion,
    closeBrackets,
    closeBracketsKeymap,
    completionKeymap
  } from '@codemirror/autocomplete';
  import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
  import { lintGutter, lintKeymap } from '@codemirror/lint';
  // Languages
  import { javascript } from '@codemirror/lang-javascript';
  import { rust } from '@codemirror/lang-rust';
  import { json } from '@codemirror/lang-json';
  import { markdown } from '@codemirror/lang-markdown';
  import { oneDark } from '@codemirror/theme-one-dark';
  // App
  import { store } from '$lib/state.svelte';
  import { settings } from '$lib/settings.svelte';
  import { detectLanguage } from '$lib/utils/language-detect';
  import * as Select from '$lib/components/ui/select';
  import * as Popover from '$lib/components/ui/popover';
  import { Settings } from '@lucide/svelte';

  let { config, nodeId }: { config: Record<string, unknown>; nodeId: string } =
    $props();

  let editorContainer: HTMLDivElement;
  let view: EditorView | null = null;

  // Compartments — un par option toggleable
  const langCompartment = new Compartment();
  const lineNumbersComp = new Compartment();
  const wordWrapComp = new Compartment();
  const highlightLineComp = new Compartment();
  const fontSizeComp = new Compartment();
  const readOnlyComp = new Compartment();
  const indentUnitComp = new Compartment();
  const autocompletionComp = new Compartment();
  const lintComp = new Compartment();
  const editorThemeComp = new Compartment();

  let loading = $state(false);
  let fileError = $state<string | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const filePath = $derived((config.filePath as string | null) ?? null);
  const langOverride = $derived((config.language as string | null) ?? null);
  const activeLang = $derived(langOverride ?? detectLanguage(filePath));
  const fileName = $derived(filePath ? filePath.split('/').pop() : null);

  // Résolution des settings effectifs : override widget > global
  function eff<T>(key: keyof typeof settings.editor, fallback: T): T {
    const override = config[key];
    return override !== undefined && override !== null
      ? (override as T)
      : ((settings.editor[key] as T) ?? fallback);
  }

  const effLineNumbers = $derived(eff('lineNumbers', true));
  const effWordWrap = $derived(eff('wordWrap', false));
  const effHighlightActiveLine = $derived(eff('highlightActiveLine', true));
  const effFontSize = $derived(eff('fontSize', 13));
  const effReadOnly = $derived(eff('readOnly', false));
  const effIndentUnit = $derived(eff('indentUnit', 2));
  const effAutocompletion = $derived(eff('autocompletion', true));
  const effLint = $derived(eff('lint', false));
  const effEditorTheme = $derived(eff('editorTheme', 'oneDark'));

  const SUPPORTED_LANGUAGES = [
    'text',
    'typescript',
    'javascript',
    'rust',
    'json',
    'markdown'
  ];

  function getLangExtension(lang: string) {
    switch (lang) {
      case 'typescript':
        return javascript({ typescript: true });
      case 'javascript':
        return javascript();
      case 'rust':
        return rust();
      case 'json':
        return json();
      case 'markdown':
        return markdown();
      default:
        return [];
    }
  }

  function dispatch(comp: Compartment, ext: unknown) {
    view?.dispatch({
      effects: comp.reconfigure(ext as Parameters<typeof comp.reconfigure>[0])
    });
  }

  // Resync Compartments quand les valeurs effectives changent
  $effect(() => {
    dispatch(langCompartment, getLangExtension(activeLang));
  });
  $effect(() => {
    dispatch(lineNumbersComp, effLineNumbers ? cmLineNumbers() : []);
  });
  $effect(() => {
    dispatch(wordWrapComp, effWordWrap ? EditorView.lineWrapping : []);
  });
  $effect(() => {
    dispatch(
      highlightLineComp,
      effHighlightActiveLine ? cmHighlightActiveLine() : []
    );
  });
  $effect(() => {
    dispatch(
      fontSizeComp,
      EditorView.theme({ '&': { fontSize: `${effFontSize}px` } })
    );
  });
  $effect(() => {
    dispatch(readOnlyComp, EditorState.readOnly.of(effReadOnly));
  });
  $effect(() => {
    dispatch(indentUnitComp, indentUnit.of(' '.repeat(effIndentUnit)));
  });
  $effect(() => {
    dispatch(autocompletionComp, effAutocompletion ? cmAutocompletion() : []);
  });
  $effect(() => {
    dispatch(lintComp, effLint ? lintGutter() : []);
  });
  $effect(() => {
    dispatch(editorThemeComp, effEditorTheme === 'oneDark' ? oneDark : []);
  });

  async function openFile() {
    const selected = await openDialog({ multiple: false, directory: false });
    if (!selected) return;
    await loadFile(selected as string);
  }

  async function loadFile(path: string) {
    loading = true;
    fileError = null;
    try {
      const content = await invoke<string>('read_file', { path });
      store.updateWidgetConfig(nodeId, { filePath: path, language: null });
      view?.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content }
      });
    } catch (err) {
      fileError = String(err);
      store.updateWidgetConfig(nodeId, { filePath: null, language: null });
    } finally {
      loading = false;
    }
  }

  function scheduleSave(content: string) {
    if (!filePath) return;
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      store.setSaving(nodeId, true);
      try {
        await invoke('write_file', { path: filePath, content });
      } catch (err) {
        console.error('[CodeWidget] write_file failed:', err);
      } finally {
        store.setSaving(nodeId, false);
      }
    }, 1000);
  }

  onMount(async () => {
    view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          // Extensions fixes
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          closeBrackets(),
          rectangularSelection(),
          crosshairCursor(),
          highlightSelectionMatches(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap
          ]),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto' }
          }),
          // Compartments
          langCompartment.of(getLangExtension(activeLang)),
          lineNumbersComp.of(effLineNumbers ? cmLineNumbers() : []),
          wordWrapComp.of(effWordWrap ? EditorView.lineWrapping : []),
          highlightLineComp.of(
            effHighlightActiveLine ? cmHighlightActiveLine() : []
          ),
          fontSizeComp.of(
            EditorView.theme({ '&': { fontSize: `${effFontSize}px` } })
          ),
          readOnlyComp.of(EditorState.readOnly.of(effReadOnly)),
          indentUnitComp.of(indentUnit.of(' '.repeat(effIndentUnit))),
          autocompletionComp.of(effAutocompletion ? cmAutocompletion() : []),
          lintComp.of(effLint ? lintGutter() : []),
          editorThemeComp.of(effEditorTheme === 'oneDark' ? oneDark : []),
          // Listener
          EditorView.updateListener.of(
            (update: import('@codemirror/view').ViewUpdate) => {
              if (update.docChanged && filePath) {
                scheduleSave(update.state.doc.toString());
              }
            }
          )
        ]
      }),
      parent: editorContainer
    });

    if (filePath) {
      await loadFile(filePath);
    }
  });

  onDestroy(() => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    view?.destroy();
  });

  function setLanguageOverride(lang: string) {
    const isAutoDetected = lang === detectLanguage(filePath);
    store.updateWidgetConfig(nodeId, {
      ...config,
      language: isAutoDetected ? null : lang
    });
  }

  function setOverride<K extends keyof typeof settings.editor>(
    key: K,
    value: (typeof settings.editor)[K] | null
  ) {
    store.updateWidgetConfig(nodeId, { ...config, [key]: value });
  }

  function resetOverrides() {
    const { filePath: fp, language: lang } = config as {
      filePath?: unknown;
      language?: unknown;
    };
    store.updateWidgetConfig(nodeId, {
      filePath: fp ?? null,
      language: lang ?? null
    });
  }

  // Indique si au moins un override est actif
  const hasOverrides = $derived(
    [
      'lineNumbers',
      'wordWrap',
      'highlightActiveLine',
      'fontSize',
      'readOnly',
      'indentUnit',
      'autocompletion',
      'lint',
      'editorTheme'
    ].some(k => config[k] !== undefined && config[k] !== null)
  );
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
  <!-- Header -->
  <div
    class="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-2"
  >
    <!-- Bouton paramètres éditeur -->
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
        <div
          class="flex items-center justify-between border-b border-border px-3 py-2"
        >
          <span class="text-xs font-semibold">Paramètres de l'éditeur</span>
          {#if hasOverrides}
            <button
              class="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onclick={resetOverrides}
            >
              Réinitialiser
            </button>
          {/if}
        </div>

        <div class="divide-y divide-border">
          {#each [{ label: 'Numéros de ligne', key: 'lineNumbers', value: effLineNumbers }, { label: 'Retour à la ligne', key: 'wordWrap', value: effWordWrap }, { label: 'Ligne active surlignée', key: 'highlightActiveLine', value: effHighlightActiveLine }, { label: 'Auto-complétion', key: 'autocompletion', value: effAutocompletion }, { label: 'Lint', key: 'lint', value: effLint }, { label: 'Lecture seule', key: 'readOnly', value: effReadOnly }] as row}
            <div class="flex items-center justify-between px-3 py-2">
              <span class="text-xs text-muted-foreground">{row.label}</span>
              <button
                role="switch"
                aria-label={row.label}
                aria-checked={row.value}
                onclick={() =>
                  setOverride(
                    row.key as keyof typeof settings.editor,
                    !row.value as never
                  )}
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
                if (v >= 10 && v <= 24) setOverride('fontSize', v);
              }}
              class="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-xs text-muted-foreground">Indentation</span>
            <select
              value={effIndentUnit}
              onchange={e =>
                setOverride(
                  'indentUnit',
                  parseInt((e.target as HTMLSelectElement).value) as 2 | 4 | 8
                )}
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
              onchange={e =>
                setOverride(
                  'editorTheme',
                  (e.target as HTMLSelectElement).value as 'oneDark' | 'default'
                )}
              class="rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="oneDark">One Dark</option>
              <option value="default">Défaut</option>
            </select>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>

    <Select.Root
      type="single"
      value={activeLang}
      onValueChange={v => setLanguageOverride(v)}
    >
      <Select.Trigger>{activeLang}</Select.Trigger>
      <Select.Content>
        {#each SUPPORTED_LANGUAGES as lang}
          <Select.Item value={lang} label={lang} />
        {/each}
      </Select.Content>
    </Select.Root>

    <button
      class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      onclick={openFile}
      disabled={loading}
    >
      Ouvrir
    </button>

    <span class="flex-1 truncate text-xs text-muted-foreground">
      {fileName ?? 'Aucun fichier'}
    </span>

    {#if store.savingWidgets.has(nodeId)}
      <span class="text-xs text-muted-foreground/60">Sauvegarde…</span>
    {/if}

    {#if loading}
      <span class="text-xs text-muted-foreground/60">Chargement…</span>
    {/if}
  </div>

  <!-- Éditeur -->
  <div class="relative min-h-0 flex-1">
    <div
      bind:this={editorContainer}
      class="h-full w-full overflow-hidden"
    ></div>

    {#if fileError}
      <div
        class="absolute inset-0 flex items-center justify-center bg-background/80"
      >
        <div
          class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/50 bg-card p-6"
        >
          <p class="text-center text-sm text-destructive">
            Impossible de lire le fichier :
          </p>
          <code class="text-center text-xs text-muted-foreground break-all"
            >{fileError}</code
          >
          <button
            class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onclick={() => {
              fileError = null;
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    {/if}

    {#if !filePath && !fileError}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <span class="text-sm text-muted-foreground">Aucun fichier ouvert</span
          >
          <button
            class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onclick={openFile}
          >
            Ouvrir un fichier
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
