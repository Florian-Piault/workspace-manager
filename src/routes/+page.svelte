<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '$lib/state.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import LayoutEngine from '$lib/components/LayoutEngine.svelte';

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
        store.splitPanel(store.activePanelId, 'vertical');
      } else if (mod && e.key === '-') {
        e.preventDefault();
        e.stopPropagation();
        store.splitPanel(store.activePanelId, 'horizontal');
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
      <div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p class="text-sm">Sélectionne un workspace dans la sidebar pour commencer.</p>
      </div>
    {/if}
  </main>
</div>
