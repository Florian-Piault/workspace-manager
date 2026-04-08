<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { ArrowLeft, ArrowRight, RotateCw, Loader } from '@lucide/svelte';
  import { store } from '$lib/state.svelte';

  let { config, nodeId }: { config: Record<string, unknown>; nodeId: string } =
    $props();

  const DEFAULT_URL = 'https://after-glow.fr';

  let urlInput = $state(
    untrack(() => (config.url as string | undefined) ?? DEFAULT_URL)
  );
  let error = $state<string | null>(null);
  let loading = $state(false);
  let refreshRotation = $state(0);

  let container: HTMLDivElement;
  let unlistenUrl: (() => void) | null = null;
  let unlistenTitle: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let mounted = true;

  function getBounds() {
    const rect = container.getBoundingClientRect();
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
  }

  async function open() {
    const { x, y, w, h } = getBounds();
    await invoke('browser_open', { id: nodeId, url: urlInput, x, y, w, h });
  }

  onMount(async () => {
    unlistenUrl = await listen<string>(`browser_url:${nodeId}`, event => {
      urlInput = event.payload;
      loading = false;
      store.updateWidgetConfig(nodeId, { url: event.payload });
    });

    unlistenTitle = await listen<string>(`browser_title:${nodeId}`, event => {
      if (event.payload) store.updateWidgetLabel(nodeId, event.payload);
    });

    // Attendre un frame pour que paneforge finalise le layout
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    try {
      await open();
    } catch (err) {
      error = String(err);
    }

    resizeObserver = new ResizeObserver(() => {
      if (!mounted) return;
      const { x, y, w, h } = getBounds();
      invoke('browser_resize', { id: nodeId, x, y, w, h }).catch(() => {});
    });
    resizeObserver.observe(container);
  });

  onDestroy(() => {
    mounted = false;
    unlistenUrl?.();
    unlistenTitle?.();
    resizeObserver?.disconnect();
    invoke('browser_close', { id: nodeId }).catch(() => {});
  });

  function normalizeUrl(raw: string) {
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `https://${raw}`;
  }

  async function navigate(target: string) {
    const url = normalizeUrl(target);
    urlInput = url;
    error = null;
    loading = true;
    try {
      await invoke('browser_navigate', { id: nodeId, url });
    } catch (err) {
      loading = false;
      error = String(err);
    }
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    navigate(urlInput);
  }

  function back() {
    loading = true;
    invoke('browser_back', { id: nodeId }).catch(() => {
      loading = false;
    });
  }
  function forward() {
    loading = true;
    invoke('browser_forward', { id: nodeId }).catch(() => {
      loading = false;
    });
  }
  function refresh() {
    refreshRotation += 90;
    loading = true;
    invoke('browser_refresh', { id: nodeId }).catch(() => {
      loading = false;
    });
  }
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
  <!-- Barre de contrôle DOM (protège le WidgetPill du z-layer natif) -->
  <div
    class="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-2"
  >
    <button
      class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      onclick={back}
      title="Précédent"
    >
      <ArrowLeft class="h-3.5 w-3.5" />
    </button>
    <button
      class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      onclick={forward}
      title="Suivant"
    >
      <ArrowRight class="h-3.5 w-3.5" />
    </button>
    <button
      class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      onclick={refresh}
      title="Actualiser"
    >
      <RotateCw
        class="h-3.5 w-3.5 transition-transform duration-200"
        style="transform: rotate({refreshRotation}deg)"
      />
    </button>

    <form class="relative min-w-0 flex-1" onsubmit={handleSubmit}>
      {#if loading}
        <Loader
          class="absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      {/if}
      <input
        type="text"
        class="h-6 w-full rounded border border-border bg-background px-2 text-xs text-foreground
               placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring
               {loading ? 'pr-6' : ''}"
        bind:value={urlInput}
        placeholder="https://..."
        spellcheck="false"
        autocomplete="off"
      />
    </form>
  </div>

  <!-- Zone réservée pour la webview native Tauri -->
  <div bind:this={container} class="min-h-0 flex-1">
    {#if error}
      <div class="flex h-full items-center justify-center">
        <div
          class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/50 bg-card p-6"
        >
          <p class="text-center text-sm text-destructive">
            Impossible d'ouvrir le navigateur :
          </p>
          <code class="break-all text-center text-xs text-muted-foreground"
            >{error}</code
          >
          <button
            class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground
                   hover:bg-primary/90 transition-colors"
            onclick={() => {
              error = null;
              open().catch(e => {
                error = String(e);
              });
            }}
          >
            Réessayer
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
