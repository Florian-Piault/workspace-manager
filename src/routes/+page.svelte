<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '$lib/state.svelte';
  import { flatWidgets } from '$lib/layout';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import LayoutEngine from '$lib/components/LayoutEngine.svelte';
  import PanelOverlay from '$lib/components/PanelOverlay.svelte';
  import CodeWidget from '$lib/components/widgets/CodeWidget.svelte';
  import TerminalWidget from '$lib/components/widgets/TerminalWidget.svelte';
  import BrowserWidget from '$lib/components/widgets/BrowserWidget.svelte';

  const maximizedWidget = $derived(
    store.maximizedPanelId && store.activeLayout
      ? (flatWidgets(store.activeLayout.root).find((w) => w.id === store.maximizedPanelId) ?? null)
      : null
  );

  onMount(() => {
    store.init().catch((err) => {
      console.error('[WorkspaceStore] init failed:', err);
    });

    function handleKeydown(e: KeyboardEvent) {
      if (!store.activePanelId) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === '\\') {
        e.preventDefault();
        e.stopPropagation();
        store.splitPanel(store.activePanelId, 'horizontal');
      } else if (mod && e.key === '-') {
        e.preventDefault();
        e.stopPropagation();
        store.splitPanel(store.activePanelId, 'vertical');
      } else if (mod && e.key === 'w') {
        e.preventDefault();
        e.stopPropagation();
        store.closePanel(store.activePanelId);
      }
    }

    window.addEventListener('keydown', handleKeydown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeydown, { capture: true });
  });
</script>

<div class="flex h-screen w-screen overflow-hidden bg-background text-foreground">
  <Sidebar />

  <main class="relative flex-1 overflow-hidden">
    {#if store.activeLayout}
      <LayoutEngine node={store.activeLayout.root} isRoot={true} />
    {:else}
      <div class="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground select-none">
        <div class="flex flex-col items-center gap-2">
          <p class="text-sm font-medium text-foreground">Aucun workspace actif</p>
          <p class="text-xs">Sélectionne un workspace dans la barre latérale</p>
          <p class="text-xs">ou crée-en un avec le bouton <kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">+</kbd></p>
        </div>
      </div>
    {/if}

    <!-- Overlay maximize -->
    {#if maximizedWidget}
      <div class="absolute inset-0 z-40 bg-background">
        <PanelOverlay nodeId={maximizedWidget.id} widget={maximizedWidget} isRoot={true}>
          {#if maximizedWidget.type === 'code'}
            <CodeWidget config={maximizedWidget.config} nodeId={maximizedWidget.id} />
          {:else if maximizedWidget.type === 'terminal'}
            <TerminalWidget config={maximizedWidget.config} nodeId={maximizedWidget.id} />
          {:else if maximizedWidget.type === 'browser'}
            <BrowserWidget config={maximizedWidget.config} />
          {/if}
        </PanelOverlay>
      </div>
    {/if}
  </main>
</div>
