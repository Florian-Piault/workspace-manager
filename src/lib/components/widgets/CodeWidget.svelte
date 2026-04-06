<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { EditorView, basicSetup } from 'codemirror';
  import { EditorState, Compartment } from '@codemirror/state';
  import { javascript } from '@codemirror/lang-javascript';
  import { rust } from '@codemirror/lang-rust';
  import { json } from '@codemirror/lang-json';
  import { markdown } from '@codemirror/lang-markdown';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { store } from '$lib/state.svelte';
  import { detectLanguage } from '$lib/utils/language-detect';

  let { config, nodeId }: { config: Record<string, unknown>; nodeId: string } = $props();

  let editorContainer: HTMLDivElement;
  let view: EditorView | null = null;
  const langCompartment = new Compartment();

  let loading = $state(false);
  let saving = $state(false);
  let fileError = $state<string | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const filePath = $derived((config.filePath as string | null) ?? null);
  const langOverride = $derived((config.language as string | null) ?? null);
  const activeLang = $derived(langOverride ?? detectLanguage(filePath));
  const fileName = $derived(filePath ? filePath.split('/').pop() : null);

  const SUPPORTED_LANGUAGES = ['text', 'typescript', 'javascript', 'rust', 'json', 'markdown'];

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

  // Resynchronise le Compartment quand activeLang change (override manuel ou nouveau fichier)
  $effect(() => {
    if (view) {
      view.dispatch({ effects: langCompartment.reconfigure(getLangExtension(activeLang)) });
    }
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
        changes: { from: 0, to: view.state.doc.length, insert: content },
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
      saving = true;
      try {
        await invoke('write_file', { path: filePath, content });
      } catch (err) {
        console.error('[CodeWidget] write_file failed:', err);
      } finally {
        saving = false;
      }
    }, 1000);
  }

  onMount(async () => {
    view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          basicSetup,
          oneDark,
          langCompartment.of(getLangExtension(activeLang)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && filePath) {
              scheduleSave(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: editorContainer,
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
      language: isAutoDetected ? null : lang,
    });
  }
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
  <!-- Header -->
  <div class="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-2">
    <select
      class="bg-transparent text-xs text-muted-foreground outline-none cursor-pointer hover:text-foreground transition-colors"
      value={activeLang}
      onchange={(e) => setLanguageOverride((e.target as HTMLSelectElement).value)}
    >
      {#each SUPPORTED_LANGUAGES as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>

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

    {#if saving}
      <span class="text-xs text-muted-foreground/60">Sauvegarde…</span>
    {/if}

    {#if loading}
      <span class="text-xs text-muted-foreground/60">Chargement…</span>
    {/if}
  </div>

  <!-- Éditeur -->
  <div class="relative min-h-0 flex-1">
    <div bind:this={editorContainer} class="h-full w-full overflow-auto"></div>

    {#if fileError}
      <div class="absolute inset-0 flex items-center justify-center bg-black/60">
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
