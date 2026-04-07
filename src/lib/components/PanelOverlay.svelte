<script lang="ts">
  import { store, type DropSide } from '$lib/state.svelte';
  import { onDestroy } from 'svelte';
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
  const hoverSide = $derived(store.dragHoverTargetId === nodeId ? store.dragHoverSide : null);
  let pointerDragSourceId: string | null = null;

  function cleanupPointerDrag() {
    window.removeEventListener('pointerup', handleGlobalPointerUp, true);
    window.removeEventListener('pointermove', handleGlobalPointerMove, true);
    window.removeEventListener('pointercancel', handleGlobalPointerCancel, true);
    document.body.classList.remove('dnd-active');
    document.body.classList.remove('dnd-pointer-active');
    pointerDragSourceId = null;
    store.endDrag();
  }

  function handleHandlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    pointerDragSourceId = nodeId;
    store.startDrag(nodeId);
    document.body.classList.add('dnd-active');
    document.body.classList.add('dnd-pointer-active');
    window.addEventListener('pointerup', handleGlobalPointerUp, true);
    window.addEventListener('pointermove', handleGlobalPointerMove, true);
    window.addEventListener('pointercancel', handleGlobalPointerCancel, true);
  }

  function handleGlobalPointerMove(e: PointerEvent) {
    if (!pointerDragSourceId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const zone = el?.closest('[data-drop-zone="true"]') as HTMLElement | null;
    const side = (zone?.dataset.dropSide ?? null) as DropSide | null;
    const targetId = zone?.dataset.dropNodeId ?? null;

    if (!side || !targetId || targetId === pointerDragSourceId) {
      store.setDragHover(null, null);
      return;
    }
    store.setDragHover(targetId, side);
  }

  function handleGlobalPointerUp(e: PointerEvent) {
    if (!pointerDragSourceId) return;
    const side = store.dragHoverSide;
    const targetId = store.dragHoverTargetId;

    if (targetId && side) {
      store.dropWidget(targetId, side, pointerDragSourceId);
    } else {
      store.endDrag();
    }
    cleanupPointerDrag();
  }

  function handleGlobalPointerCancel() {
    cleanupPointerDrag();
  }

  onDestroy(() => {
    cleanupPointerDrag();
  });

</script>

<div
  class="group relative h-full w-full {isActive ? 'ring-1 ring-primary ring-inset' : ''}"
  onclick={() => store.setActivePanel(nodeId)}
  role="group"
>
  {@render children()}
  <WidgetPill {nodeId} {widget} {isRoot} />

  <!-- Drag handle — always in DOM, opacity-controlled -->
  <div
    onpointerdown={handleHandlePointerDown}
    class="absolute top-1 left-1 z-20 flex cursor-grab active:cursor-grabbing items-center justify-center w-8 h-8 rounded
           opacity-90 hover:opacity-100 transition-opacity select-none
           text-muted-foreground hover:text-foreground hover:bg-accent/60"
    title="Déplacer le widget"
    role="button"
    tabindex="-1"
    aria-label="Déplacer le widget"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="7" cy="4"  r="1.8"/>
      <circle cx="13" cy="4" r="1.8"/>
      <circle cx="7" cy="10" r="1.8"/>
      <circle cx="13" cy="10" r="1.8"/>
      <circle cx="7" cy="16" r="1.8"/>
      <circle cx="13" cy="16" r="1.8"/>
    </svg>
  </div>

  <!-- Drop zones — visible only during native drag (body.dnd-active) -->
  <!-- Outer ring -->
  <div
    class="drop-ring absolute inset-0 z-30 ring-inset rounded pointer-events-none transition-all"
  ></div>

  <!-- Top -->
  <div
    class="drop-zone drop-zone-top absolute top-0 left-0 right-0 h-1/4 z-40 transition-colors
           {hoverSide === 'top' ? 'bg-primary/30 border-t-2 border-primary' : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="top"
    role="none"
  ></div>

  <!-- Bottom -->
  <div
    class="drop-zone drop-zone-bottom absolute bottom-0 left-0 right-0 h-1/4 z-40 transition-colors
           {hoverSide === 'bottom' ? 'bg-primary/30 border-b-2 border-primary' : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="bottom"
    role="none"
  ></div>

  <!-- Left -->
  <div
    class="drop-zone drop-zone-left absolute top-1/4 bottom-1/4 left-0 w-1/4 z-40 transition-colors
           {hoverSide === 'left' ? 'bg-primary/30 border-l-2 border-primary' : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="left"
    role="none"
  ></div>

  <!-- Right -->
  <div
    class="drop-zone drop-zone-right absolute top-1/4 bottom-1/4 right-0 w-1/4 z-40 transition-colors
           {hoverSide === 'right' ? 'bg-primary/30 border-r-2 border-primary' : ''}"
    data-drop-zone="true"
    data-drop-node-id={nodeId}
    data-drop-side="right"
    role="none"
  ></div>

  <!-- Center (swap) -->
  <div
    class="drop-zone drop-zone-center absolute top-1/4 bottom-1/4 left-1/4 right-1/4 z-40 transition-colors rounded
           {hoverSide === 'center' ? 'bg-primary/30 border-2 border-dashed border-primary' : ''}"
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
    box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--color-primary) 50%, transparent);
  }

  :global(body.dnd-pointer-active) {
    cursor: grabbing !important;
  }
</style>
