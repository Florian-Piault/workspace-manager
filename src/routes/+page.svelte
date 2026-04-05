<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '$lib/state.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import LayoutEngine from '$lib/components/LayoutEngine.svelte';

  onMount(() => {
    store.init();

    function handleKeydown(e: KeyboardEvent) {
      if (!store.activePanelId) return;
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        store.splitPanel(store.activePanelId, 'vertical');
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        store.splitPanel(store.activePanelId, 'horizontal');
      } else if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        store.closePanel(store.activePanelId);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
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
