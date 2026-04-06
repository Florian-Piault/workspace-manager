<script lang="ts">
  import { Columns2, Rows2, X } from '@lucide/svelte';
  import { store } from '$lib/state.svelte';
  import type { Snippet } from 'svelte';

  let {
    nodeId,
    isRoot = false,
    children,
  }: {
    nodeId: string;
    isRoot?: boolean;
    children: Snippet;
  } = $props();

  const isActive = $derived(store.activePanelId === nodeId);
</script>

<div
  class="group relative h-full w-full {isActive ? 'ring-1 ring-primary ring-inset' : ''}"
  onclick={() => store.setActivePanel(nodeId)}
  role="group"
>
  {@render children()}

  <div
    class="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0
           transition-opacity group-hover:opacity-100"
  >
    <button
      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={(e) => { e.stopPropagation(); store.splitPanel(nodeId, 'horizontal'); }}
      title="Split vertical"
    >
      <Columns2 class="h-3.5 w-3.5" />
    </button>
    <button
      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={(e) => { e.stopPropagation(); store.splitPanel(nodeId, 'vertical'); }}
      title="Split horizontal"
    >
      <Rows2 class="h-3.5 w-3.5" />
    </button>
    <button
      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground
             disabled:pointer-events-none disabled:opacity-30"
      disabled={isRoot}
      onclick={(e) => { e.stopPropagation(); store.closePanel(nodeId); }}
      title="Fermer"
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </div>
</div>
