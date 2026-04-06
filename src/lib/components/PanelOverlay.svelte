<script lang="ts">
  import { store } from '$lib/state.svelte';
  import type { Snippet } from 'svelte';
  import type { Widget } from '$lib/types';
  import WidgetPill from './widgets/WidgetPill.svelte';

  let {
    nodeId,
    isRoot = false,
    widget,
    children,
  }: {
    nodeId: string;
    isRoot?: boolean;
    widget: Widget;
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
  <WidgetPill {nodeId} {widget} {isRoot} />
</div>
