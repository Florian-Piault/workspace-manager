<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { invoke } from '@tauri-apps/api/core';
  import { confirm } from '@tauri-apps/plugin-dialog';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
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
  import { javascript } from '@codemirror/lang-javascript';
  import { rust } from '@codemirror/lang-rust';
  import { json } from '@codemirror/lang-json';
  import { markdown } from '@codemirror/lang-markdown';
  import { oneDark } from '@codemirror/theme-one-dark';
  // App
  import { store } from '$lib/state.svelte';
  import { settings } from '$lib/settings.svelte';
  import { detectLanguage } from '$lib/utils/language-detect';
  import type { Snippet } from 'svelte';
  import FileNode from './FileNode.svelte';
  import CodeEditorHeader from './CodeEditorHeader.svelte';
  import { setFileTreeContext, type FileTreeContext, type PendingCreate } from './file-tree-context';
  import type { FileEntry, CodeEditorConfig } from './types';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import { File, Folder } from '@lucide/svelte';

  let { config, nodeId, pillControls }: { config: Record<string, unknown>; nodeId: string; pillControls?: Snippet } = $props();

  const cfg = $derived(config as unknown as CodeEditorConfig);
  const activeFilePath = $derived(cfg.activeFilePath ?? null);
  const langOverride = $derived((config.language as string | null) ?? null);
  const activeLang = $derived(langOverride ?? detectLanguage(activeFilePath));
  const fileName = $derived(activeFilePath ? (activeFilePath.split('/').pop() ?? null) : null);
  const treeHidden = $derived(cfg.treeHidden ?? false);
  const workspaceRoot = $derived(
    (cfg.rootPath as string | null) ?? store.activeWorkspace?.path ?? null
  );
  const expandedFolders = $derived(cfg.expandedFolders ?? []);

  // Per-widget overrides : widget config > global settings > fallback
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
  const effShowHiddenFiles = $derived(eff('showHiddenFiles', false));
  const effExcludePatterns = $derived(eff<string[]>('excludePatterns', ['node_modules', '.git', 'target', 'dist']));

  const EDITOR_OVERRIDE_KEYS = [
    'lineNumbers', 'wordWrap', 'highlightActiveLine', 'fontSize', 'readOnly',
    'indentUnit', 'autocompletion', 'lint', 'editorTheme', 'showHiddenFiles', 'excludePatterns'
  ];

  const hasOverrides = $derived(
    EDITOR_OVERRIDE_KEYS.some(k => config[k] !== undefined && config[k] !== null)
  );

  // File tree state
  let rootEntries = $state<FileEntry[]>([]);
  let treeError = $state<string | null>(null);

  // CRUD state — SvelteMap/SvelteSet provide per-key reactivity, so mutations only
  // invalidate the specific FileNode watching that path.
  const refreshKeys = new SvelteMap<string, number>();
  const expanded = new SvelteSet<string>();
  let pendingCreate = $state<PendingCreate | null>(null);
  let crudError = $state<string | null>(null);

  function bumpDir(dirPath: string) {
    refreshKeys.set(dirPath, (refreshKeys.get(dirPath) ?? 0) + 1);
  }

  /**
   * Keep the local reactive `expanded` set in sync with the serialized config
   * (the config is the persisted source of truth, but the SvelteSet is what
   * children subscribe to for fine-grained reactivity). `$effect.pre` runs
   * before DOM updates so the set is populated before children render. Using
   * a diff avoids spuriously invalidating unrelated `has()` consumers.
   */
  $effect.pre(() => {
    const desired = new Set(expandedFolders);
    untrack(() => {
      for (const p of expanded) if (!desired.has(p)) expanded.delete(p);
      for (const p of desired) if (!expanded.has(p)) expanded.add(p);
    });
  });

  // Editor state
  let editorContainer: HTMLDivElement;
  let view: EditorView | null = null;
  let loading = $state(false);
  let fileError = $state<string | null>(null);
  let isDirty = $state(false);
  let isSaving = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // Compartments
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

  $effect(() => {
    const label = fileName ?? 'Code Editor';
    untrack(() => store.setAutoLabel(nodeId, label));
  });

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

  // Re-load tree when filesystem settings change
  $effect(() => {
    // track these reactive values
    const _hidden = effShowHiddenFiles;
    const _patterns = effExcludePatterns;
    if (workspaceRoot) {
      untrack(() => loadRootEntries());
    }
  });

  async function loadRootEntries() {
    if (!workspaceRoot) return;
    treeError = null;
    try {
      rootEntries = await invoke<FileEntry[]>('get_directory_contents', {
        path: workspaceRoot,
        workspaceRoot,
        showHiddenFiles: effShowHiddenFiles,
        excludePatterns: effExcludePatterns,
      });
    } catch (err) {
      treeError = String(err);
    }
  }

  async function openFile(path: string) {
    loading = true;
    fileError = null;
    try {
      const content = await invoke<string>('read_file', { path });
      store.updateWidgetConfig(nodeId, { ...config, activeFilePath: path });
      view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
      isDirty = false;
    } catch (err) {
      fileError = String(err);
    } finally {
      loading = false;
    }
  }

  function scheduleSave(content: string) {
    if (!activeFilePath || effAutoSaveDelay === 0) return;
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      isSaving = true;
      try {
        await invoke('write_file', { path: activeFilePath, content });
        isDirty = false;
      } catch (err) {
        console.error('[CodeEditorWidget] write_file failed:', err);
      } finally {
        isSaving = false;
      }
    }, effAutoSaveDelay);
  }

  function saveImmediately() {
    if (!activeFilePath || !view) return;
    if (saveTimer !== null) { clearTimeout(saveTimer); saveTimer = null; }
    const content = view.state.doc.toString();
    isSaving = true;
    invoke('write_file', { path: activeFilePath, content })
      .then(() => { isDirty = false; })
      .catch(err => console.error('[CodeEditorWidget] write_file failed:', err))
      .finally(() => { isSaving = false; });
  }

  function setLanguageOverride(lang: string) {
    const isAutoDetected = lang === detectLanguage(activeFilePath);
    store.updateWidgetConfig(nodeId, { ...config, language: isAutoDetected ? null : lang });
  }

  function setOverride<K extends keyof typeof settings.editor>(
    key: K,
    value: (typeof settings.editor)[K] | null
  ) {
    store.updateWidgetConfig(nodeId, { ...config, [key]: value });
  }

  function resetOverrides() {
    const { rootPath, activeFilePath: afp, sidebarWidth, treeHidden: th, expandedFolders: ef } = cfg;
    store.updateWidgetConfig(nodeId, {
      rootPath: rootPath ?? null,
      activeFilePath: afp ?? null,
      sidebarWidth: sidebarWidth ?? 25,
      treeHidden: th ?? false,
      expandedFolders: ef ?? [],
    });
  }

  function toggleTree() {
    store.updateWidgetConfig(nodeId, { ...config, treeHidden: !treeHidden });
  }

  function handleToggleFolder(path: string, open: boolean) {
    const current = expandedFolders;
    const next = open
      ? [...current, path]
      : current.filter(p => p !== path);
    store.updateWidgetConfig(nodeId, { ...config, expandedFolders: next });
  }

  // CRUD handlers
  function handleCreateFile(parentPath: string) {
    if (!expandedFolders.includes(parentPath)) {
      handleToggleFolder(parentPath, true);
    }
    pendingCreate = { parentPath, type: 'file' };
    crudError = null;
  }

  function handleCreateDirectory(parentPath: string) {
    if (!expandedFolders.includes(parentPath)) {
      handleToggleFolder(parentPath, true);
    }
    pendingCreate = { parentPath, type: 'dir' };
    crudError = null;
  }

  async function handleConfirmCreate(name: string) {
    if (!pendingCreate || !name.trim() || !workspaceRoot) return;
    const fullPath = `${pendingCreate.parentPath}/${name.trim()}`;
    const parentPath = pendingCreate.parentPath;
    try {
      if (pendingCreate.type === 'file') {
        await invoke('create_file', { path: fullPath, workspaceRoot });
      } else {
        await invoke('create_directory', { path: fullPath, workspaceRoot });
      }
      bumpDir(parentPath);
      if (parentPath === workspaceRoot) {
        await loadRootEntries();
      }
      crudError = null;
      pendingCreate = null;
    } catch (err) {
      crudError = String(err);
      // Do NOT close pendingCreate: let user correct the name
    }
  }

  function handleCancelCreate() {
    pendingCreate = null;
    crudError = null;
  }

  async function handleRename(path: string, newName: string) {
    if (!workspaceRoot) return;
    try {
      const newPath = await invoke<string>('rename_path', { path, newName, workspaceRoot });
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      if (parentPath === workspaceRoot || parentPath === '') {
        await loadRootEntries();
      } else {
        bumpDir(parentPath);
      }
      if (activeFilePath === path) {
        store.updateWidgetConfig(nodeId, { ...config, activeFilePath: newPath });
      }
      crudError = null;
    } catch (err) {
      crudError = String(err);
    }
  }

  async function handleDelete(path: string, isDir: boolean) {
    if (!workspaceRoot) return;
    if (isDir) {
      const name = path.split('/').pop() ?? path;
      const ok = await confirm(
        `Supprimer définitivement "${name}" et tout son contenu ?`,
        { title: 'Confirmer la suppression', kind: 'warning' }
      );
      if (!ok) return;
    }
    try {
      await invoke('delete_path', { path, workspaceRoot });
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      if (parentPath === workspaceRoot || parentPath === '') {
        await loadRootEntries();
      } else {
        bumpDir(parentPath);
      }
      if (isDir) {
        const next = expandedFolders.filter(p => p !== path && !p.startsWith(path + '/'));
        store.updateWidgetConfig(nodeId, { ...config, expandedFolders: next });
      }
      if (!isDir && activeFilePath === path) {
        store.updateWidgetConfig(nodeId, { ...config, activeFilePath: null });
      }
      crudError = null;
    } catch (err) {
      crudError = String(err);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (store.activePanelId !== nodeId) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.key === settings.keybinds.toggleFileTree) {
      e.preventDefault();
      e.stopPropagation();
      toggleTree();
    }
  }

  /**
   * Provide the shared context to every descendant `FileNode`. The handler
   * identities are stable (function declarations) and the mutable fields are
   * exposed as getters so consumers track the underlying signals rather than
   * the context object identity.
   */
  const treeContext: FileTreeContext = {
    get workspaceRoot() { return workspaceRoot ?? ''; },
    get showHiddenFiles() { return effShowHiddenFiles; },
    get excludePatterns() { return effExcludePatterns; },
    get activeFilePath() { return activeFilePath; },
    get pendingCreate() { return pendingCreate; },
    expanded,
    refreshKeys,
    onFileClick: openFile,
    onToggleFolder: handleToggleFolder,
    onCreateFile: handleCreateFile,
    onCreateDirectory: handleCreateDirectory,
    onRename: handleRename,
    onDelete: handleDelete,
    onConfirmCreate: handleConfirmCreate,
    onCancelCreate: handleCancelCreate,
  };
  setFileTreeContext(treeContext);

  onMount(async () => {
    window.addEventListener('keydown', handleKeydown, { capture: true });

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
            if (update.docChanged && activeFilePath && !loading) {
              isDirty = true;
              scheduleSave(update.state.doc.toString());
            }
          })
        ]
      }),
      parent: editorContainer
    });

    await loadRootEntries();
    if (activeFilePath) await openFile(activeFilePath);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown, { capture: true });
    if (saveTimer !== null) clearTimeout(saveTimer);
    view?.destroy();
  });
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
  <CodeEditorHeader
    {fileName}
    {activeLang}
    {loading}
    {isDirty}
    {isSaving}
    {treeHidden}
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
    {effShowHiddenFiles}
    {effExcludePatterns}
    {pillControls}
    onToggleTree={toggleTree}
    onSetLanguageOverride={setLanguageOverride}
    onSetOverride={setOverride}
    onResetOverrides={resetOverrides}
  />

  <div class="min-h-0 flex-1 overflow-hidden">
    <PaneGroup direction="horizontal" class="h-full w-full">
      <!-- Sidebar arborescence -->
      <Pane
        defaultSize={cfg.sidebarWidth ?? 25}
        minSize={10}
        maxSize={50}
        onResize={(size) => {
          // Guard : paneforge fire onResize au remontage — skip si rien n'a changé
          if (Math.abs(size - (cfg.sidebarWidth ?? 25)) > 0.01) {
            store.updateWidgetConfig(nodeId, { ...config, sidebarWidth: size });
          }
        }}
        class="flex flex-col overflow-hidden border-r border-border {treeHidden ? 'hidden' : ''}"
      >
        <div class="shrink-0 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          Fichiers
        </div>
        <ContextMenu.Root>
          <ContextMenu.Trigger class="min-h-0 flex-1 overflow-y-auto py-1 flex flex-col">
            {#if treeError}
              <p class="px-3 text-xs text-destructive">{treeError}</p>
            {:else if rootEntries.length === 0 && !pendingCreate}
              <p class="px-3 text-xs text-muted-foreground/50">Aucun fichier</p>
            {:else}
              {#if pendingCreate?.parentPath === workspaceRoot}
                <div class="flex items-center gap-1.5 py-0.5 px-2">
                  {#if pendingCreate.type === 'file'}
                    <span class="w-3.5 shrink-0"></span>
                    <File class="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  {:else}
                    <span class="w-3.5 shrink-0"></span>
                    <Folder class="h-3.5 w-3.5 shrink-0 text-blue-400/80" />
                  {/if}
                  <input
                    autofocus
                    class="bg-transparent border-b border-primary outline-none text-sm flex-1 min-w-0"
                    placeholder={pendingCreate.type === 'file' ? 'nouveau-fichier.ts' : 'nouveau-dossier'}
                    onblur={(e) => { if (!(e.currentTarget as HTMLInputElement).value.trim()) handleCancelCreate(); }}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleConfirmCreate((e.currentTarget as HTMLInputElement).value.trim()); }
                      else if (e.key === 'Escape') { e.preventDefault(); handleCancelCreate(); }
                    }}
                  />
                </div>
              {/if}
              {#each rootEntries as entry (entry.path)}
                <FileNode {entry} />
              {/each}
            {/if}
            {#if crudError}
              <p class="px-3 py-1 text-xs text-destructive">{crudError}</p>
            {/if}
          </ContextMenu.Trigger>
          <ContextMenu.Content>
            <ContextMenu.Item
              onclick={() => workspaceRoot && handleCreateFile(workspaceRoot)}
              class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-accent"
            >
              <File class="h-3.5 w-3.5" />
              Nouveau fichier
            </ContextMenu.Item>
            <ContextMenu.Item
              onclick={() => workspaceRoot && handleCreateDirectory(workspaceRoot)}
              class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-accent"
            >
              <Folder class="h-3.5 w-3.5" />
              Nouveau dossier
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Root>
      </Pane>

      {#if !treeHidden}
        <PaneResizer class="w-1 bg-border hover:bg-primary/50 transition-colors" />
      {/if}

      <!-- Éditeur CodeMirror -->
      <Pane class="flex flex-col overflow-hidden">
        <div class="relative min-h-0 flex-1">
          <div bind:this={editorContainer} class="h-full w-full overflow-hidden"></div>

          {#if fileError}
            <div class="absolute inset-0 flex items-center justify-center bg-background/80">
              <div class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/50 bg-card p-6">
                <p class="text-center text-sm text-destructive">Impossible de lire le fichier :</p>
                <code class="break-all text-center text-xs text-muted-foreground">{fileError}</code>
                <button
                  class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onclick={() => { fileError = null; }}
                >
                  Fermer
                </button>
              </div>
            </div>
          {/if}

          {#if !activeFilePath && !fileError}
            <div class="absolute inset-0 flex items-center justify-center">
              <p class="text-sm text-muted-foreground">Sélectionnez un fichier pour commencer</p>
            </div>
          {/if}

          {#if loading}
            <div class="absolute inset-0 flex items-center justify-center bg-background/50">
              <span class="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"></span>
            </div>
          {/if}
        </div>
      </Pane>
    </PaneGroup>
  </div>
</div>
