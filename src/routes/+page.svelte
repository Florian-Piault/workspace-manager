<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '$lib/state.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import LayoutEngine from '$lib/components/LayoutEngine.svelte';

  onMount(async () => {
    await store.init();
  });
</script>

<div class="flex h-screen w-screen overflow-hidden bg-background text-foreground">
  <Sidebar />

  <main class="relative flex-1 overflow-hidden">
    {#if store.activeLayout}
      <LayoutEngine node={store.activeLayout.root} />
    {:else}
      <div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p class="text-sm">Sélectionne un workspace dans la sidebar pour commencer.</p>
      </div>
    {/if}
  </main>
</div>
