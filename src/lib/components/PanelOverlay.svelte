<script lang="ts">
  import { store } from '$lib/state.svelte';
  import type { Snippet } from 'svelte';
  import type { Widget } from '$lib/types';
  import WidgetPill from './widgets/WidgetPill.svelte';

  let {
    nodeId,
    isRoot = false,
    widget,
    children
  }: {
    nodeId: string;
    isRoot?: boolean;
    widget: Widget;
    children: Snippet<[Snippet]>;
  } = $props();

  const isActive = $derived(store.activePanelId === nodeId);
  const hoverSide = $derived(
    store.dragHoverTargetId === nodeId ? store.dragHoverSide : null
  );

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

  function handleContainerKeydown(e: KeyboardEvent) {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      store.setActivePanel(nodeId);
    }

    if (e.key === 'Tab' && !e.defaultPrevented) {
      const container = e.currentTarget as HTMLElement;
      const els = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE)
      );
      if (els.length === 0) return;
      const idx = els.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      const next = e.shiftKey
        ? idx <= 0
          ? els.length - 1
          : idx - 1
        : idx >= els.length - 1
          ? 0
          : idx + 1;
      els[next].focus();
    }
  }
</script>

{#snippet pillControls()}
  <WidgetPill {nodeId} {widget} {isRoot} />
{/snippet}

<div
  class="relative h-full w-full {isActive
    ? 'ring-1 ring-primary ring-inset'
    : ''}"
  onclick={() => store.setActivePanel(nodeId)}
  onkeydown={handleContainerKeydown}
  role="button"
  tabindex="0"
>
  {@render children(pillControls)}

  <!-- Drop zones — visible only during native drag (body.dnd-active) -->
  <!-- Outer ring -->
  <div
    class="drop-ring absolute inset-0 z-30 ring-inset rounded pointer-events-none transition-all"
  ></div>

  <!-- Top -->
  <div
    class="drop-zone drop-zone-top absolute top-0 left-0 right-0 h-1/4 z-40 transition-colors
           {hoverSide === 'top'
      ? 'bg-primary/30 border-t-2 border-primary'
      : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="top"
    role="none"
  ></div>

  <!-- Bottom -->
  <div
    class="drop-zone drop-zone-bottom absolute bottom-0 left-0 right-0 h-1/4 z-40 transition-colors
           {hoverSide === 'bottom'
      ? 'bg-primary/30 border-b-2 border-primary'
      : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="bottom"
    role="none"
  ></div>

  <!-- Left -->
  <div
    class="drop-zone drop-zone-left absolute top-1/4 bottom-1/4 left-0 w-1/4 z-40 transition-colors
           {hoverSide === 'left'
      ? 'bg-primary/30 border-l-2 border-primary'
      : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="left"
    role="none"
  ></div>

  <!-- Right -->
  <div
    class="drop-zone drop-zone-right absolute top-1/4 bottom-1/4 right-0 w-1/4 z-40 transition-colors
           {hoverSide === 'right'
      ? 'bg-primary/30 border-r-2 border-primary'
      : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="right"
    role="none"
  ></div>

  <!-- Center (swap) -->
  <div
    class="drop-zone drop-zone-center absolute top-0 bottom-0 w-full h-full z-39 transition-colors rounded
           {hoverSide === 'center'
      ? 'bg-primary/30 border-2 border-dashed border-primary'
      : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="center"
    role="none"
  ></div>
</div>

<style>
  .drop-zone {
    pointer-events: none;
  }

  .drop-ring {
    box-shadow: inset 0 0 0 0 transparent;
  }

  :global(body.dnd-active) .drop-zone {
    pointer-events: auto;
  }

  :global(body.dnd-active) .drop-ring {
    box-shadow: inset 0 0 0 2px
      color-mix(in oklab, var(--color-primary) 50%, transparent);
  }

  :global(body.dnd-pointer-active) {
    cursor: grabbing !important;
  }
</style>
