<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
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
  import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
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
  import CodeEditorHeader from './CodeEditorHeader.svelte';

  let { config, nodeId }: { config: Record<string, unknown>; nodeId: string } = $props();

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
  const appKeymapComp = new Compartment();

  let loading = $state(false);
  let fileError = $state<string | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const filePath = $derived((config.filePath as string | null) ?? null);
  const langOverride = $derived((config.language as string | null) ?? null);
  const activeLang = $derived(langOverride ?? detectLanguage(filePath));
  const fileName = $derived(filePath ? (filePath.split('/').pop() ?? null) : null);

  $effect(() => {
    const label = fileName ?? '';
    untrack(() => store.setAutoLabel(nodeId, label));
  });

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
  const effAutoSaveDelay = $derived(eff<number>('autoSaveDelay', 1000));

  const hasOverrides = $derived(
    ['lineNumbers', 'wordWrap', 'highlightActiveLine', 'fontSize', 'readOnly',
     'indentUnit', 'autocompletion', 'lint', 'editorTheme']
      .some(k => config[k] !== undefined && config[k] !== null)
  );

  function getLangExtension(lang: string) {
    switch (lang) {
      case 'typescript': return javascript({ typescript: true });
      case 'javascript': return javascript();
      case 'rust': return rust();
      case 'json': return json();
      case 'markdown': return markdown();
      default: return [];
    }
  }

  function dispatch(comp: Compartment, ext: unknown) {
    view?.dispatch({ effects: comp.reconfigure(ext as Parameters<typeof comp.reconfigure>[0]) });
  }

  // Resync Compartments quand les valeurs effectives changent
  $effect(() => { dispatch(langCompartment, getLangExtension(activeLang)); });
  $effect(() => { dispatch(lineNumbersComp, effLineNumbers ? cmLineNumbers() : []); });
  $effect(() => { dispatch(wordWrapComp, effWordWrap ? EditorView.lineWrapping : []); });
  $effect(() => { dispatch(highlightLineComp, effHighlightActiveLine ? cmHighlightActiveLine() : []); });
  $effect(() => { dispatch(fontSizeComp, EditorView.theme({ '&': { fontSize: `${effFontSize}px` } })); });
  $effect(() => { dispatch(readOnlyComp, EditorState.readOnly.of(effReadOnly)); });
  $effect(() => { dispatch(indentUnitComp, indentUnit.of(' '.repeat(effIndentUnit))); });
  $effect(() => { dispatch(autocompletionComp, effAutocompletion ? cmAutocompletion() : []); });
  $effect(() => { dispatch(lintComp, effLint ? lintGutter() : []); });
  $effect(() => { dispatch(editorThemeComp, effEditorTheme === 'oneDark' ? oneDark : []); });
  $effect(() => {
    const saveKey = `Mod-${settings.keybinds.saveFile}`;
    dispatch(appKeymapComp, keymap.of([{ key: saveKey, run: () => { saveImmediately(); return true; } }]));
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
      view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
    } catch (err) {
      fileError = String(err);
      store.updateWidgetConfig(nodeId, { filePath: null, language: null });
    } finally {
      loading = false;
    }
  }

  function scheduleSave(content: string) {
    if (!filePath || effAutoSaveDelay === 0) return;
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      store.setSaving(nodeId, true);
      try {
        await invoke('write_file', { path: filePath, content });
        store.setDirty(nodeId, false);
      } catch (err) {
        console.error('[CodeWidget] write_file failed:', err);
      } finally {
        store.setSaving(nodeId, false);
      }
    }, effAutoSaveDelay);
  }

  function saveImmediately() {
    if (!filePath || !view) return;
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    const content = view.state.doc.toString();
    store.setSaving(nodeId, true);
    invoke('write_file', { path: filePath, content })
      .then(() => store.setDirty(nodeId, false))
      .catch(err => console.error('[CodeWidget] write_file failed:', err))
      .finally(() => store.setSaving(nodeId, false));
  }

  function setLanguageOverride(lang: string) {
    const isAutoDetected = lang === detectLanguage(filePath);
    store.updateWidgetConfig(nodeId, { ...config, language: isAutoDetected ? null : lang });
  }

  function setOverride<K extends keyof typeof settings.editor>(
    key: K,
    value: (typeof settings.editor)[K] | null
  ) {
    store.updateWidgetConfig(nodeId, { ...config, [key]: value });
  }

  function resetOverrides() {
    const { filePath: fp, language: lang } = config as { filePath?: unknown; language?: unknown };
    store.updateWidgetConfig(nodeId, { filePath: fp ?? null, language: lang ?? null });
  }

  onMount(async () => {
    view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          highlightSpecialChars(), history(), foldGutter(), drawSelection(), dropCursor(),
          EditorState.allowMultipleSelections.of(true), indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(), closeBrackets(), rectangularSelection(), crosshairCursor(),
          highlightSelectionMatches(),
          appKeymapComp.of(keymap.of([
            { key: `Mod-${settings.keybinds.saveFile}`, run: () => { saveImmediately(); return true; } }
          ])),
          keymap.of([indentWithTab, ...closeBracketsKeymap, ...defaultKeymap,
            ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap]),
          EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
          langCompartment.of(getLangExtension(activeLang)),
          lineNumbersComp.of(effLineNumbers ? cmLineNumbers() : []),
          wordWrapComp.of(effWordWrap ? EditorView.lineWrapping : []),
          highlightLineComp.of(effHighlightActiveLine ? cmHighlightActiveLine() : []),
          fontSizeComp.of(EditorView.theme({ '&': { fontSize: `${effFontSize}px` } })),
          readOnlyComp.of(EditorState.readOnly.of(effReadOnly)),
          indentUnitComp.of(indentUnit.of(' '.repeat(effIndentUnit))),
          autocompletionComp.of(effAutocompletion ? cmAutocompletion() : []),
          lintComp.of(effLint ? lintGutter() : []),
          editorThemeComp.of(effEditorTheme === 'oneDark' ? oneDark : []),
          EditorView.updateListener.of((update: import('@codemirror/view').ViewUpdate) => {
            if (update.docChanged && filePath) {
              store.setDirty(nodeId, true);
              scheduleSave(update.state.doc.toString());
            }
          })
        ]
      }),
      parent: editorContainer
    });

    if (filePath) await loadFile(filePath);
  });

  onDestroy(() => {
    if (saveTimer !== null) clearTimeout(saveTimer);
    store.setDirty(nodeId, false);
    view?.destroy();
  });
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
  <CodeEditorHeader
    {fileName}
    {activeLang}
    {loading}
    saving={store.savingWidgets.has(nodeId)}
    {hasOverrides}
    {effLineNumbers}
    {effWordWrap}
    {effHighlightActiveLine}
    {effAutocompletion}
    {effLint}
    {effReadOnly}
    {effFontSize}
    {effIndentUnit}
    {effEditorTheme}
    onOpenFile={openFile}
    onSetLanguageOverride={setLanguageOverride}
    onSetOverride={setOverride}
    onResetOverrides={resetOverrides}
  />

  <div class="relative min-h-0 flex-1">
    <div bind:this={editorContainer} class="h-full w-full overflow-hidden"></div>

    {#if fileError}
      <div class="absolute inset-0 flex items-center justify-center bg-background/80">
        <div class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/50 bg-card p-6">
          <p class="text-center text-sm text-destructive">Impossible de lire le fichier :</p>
          <code class="text-center text-xs text-muted-foreground break-all">{fileError}</code>
          <button
            class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onclick={() => { fileError = null; }}
          >
            Fermer
          </button>
        </div>
      </div>
    {/if}

    {#if !filePath && !fileError}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <span class="text-sm text-muted-foreground">Aucun fichier ouvert</span>
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
