<script lang="ts">
  import {
    Columns2,
    Rows2,
    X,
    Maximize2,
    Minimize2,
    Terminal,
    TextAlignStart,
    Globe,
    GripVertical
  } from '@lucide/svelte';
  import { store, type DropSide } from '$lib/state.svelte';
  import { onDestroy } from 'svelte';
  import type { Widget } from '$lib/types';

  let {
    nodeId,
    widget,
    isRoot = false
  }: {
    nodeId: string;
    widget: Widget;
    isRoot?: boolean;
  } = $props();

  let editing = $state(false);
  let draft = $state('');

  function startEdit() {
    draft = widget.label ?? '';
    editing = true;
  }

  function confirmEdit() {
    editing = false;
    store.updateWidgetLabel(nodeId, draft.trim());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmEdit();
    if (e.key === 'Escape') editing = false;
  }

  const displayLabel = $derived(
    widget.label ?? store.autoLabels.get(nodeId) ?? widget.type
  );

  // --- Drag logic ---
  let pointerDragSourceId: string | null = null;

  function cleanupPointerDrag() {
    window.removeEventListener('pointerup', handleGlobalPointerUp, true);
    window.removeEventListener('pointermove', handleGlobalPointerMove, true);
    window.removeEventListener(
      'pointercancel',
      handleGlobalPointerCancel,
      true
    );
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
    const el = document.elementFromPoint(
      e.clientX,
      e.clientY
    ) as HTMLElement | null;
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
  class="absolute right-1 top-1 z-10 flex items-center gap-0.5
         rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm
         opacity-20 transition-opacity group-hover:opacity-100 border border-white/10"
>
  <!-- Drag handle -->
  <button
    onpointerdown={handleHandlePointerDown}
    class="rounded p-0.5 text-white/50 hover:text-white/90 cursor-grab active:cursor-grabbing select-none"
    title="Déplacer le widget"
    tabindex="-1"
    aria-label="Déplacer le widget"
  >
    <GripVertical class="h-3 w-3" aria-hidden="true" />
  </button>

  <div class="mx-0.5 h-3 w-px bg-white/20"></div>

  {#if widget.type === 'terminal'}
    <Terminal class="h-3 w-3 text-white/60 shrink-0" />
  {:else if widget.type === 'code'}
    <TextAlignStart class="h-3 w-3 text-white/60 shrink-0" />
  {:else if widget.type === 'browser'}
    <Globe class="h-3 w-3 text-white/60 shrink-0" />
  {/if}

  {#if widget.type !== 'empty'}
    {#if store.dirtyWidgets.has(nodeId) && widget.type === 'code'}
      <span
        class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
        title="Modifications non sauvegardées"
      ></span>
    {/if}
    {#if editing}
      <input
        class="w-20 bg-transparent text-xs text-white/90 outline-none"
        bind:value={draft}
        onblur={confirmEdit}
        onkeydown={handleKeydown}
      />
    {:else}
      <button
        class="max-w-35 truncate text-xs text-white/70 hover:text-white"
        onclick={startEdit}
        title="Double-cliquer pour renommer"
        ondblclick={startEdit}
      >
        {displayLabel}
      </button>
    {/if}
  {/if}

  <button
    class="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white"
    onclick={e => {
      e.stopPropagation();
      store.toggleMaximize(nodeId);
    }}
    title={store.maximizedPanelId === nodeId ? 'Restaurer' : 'Maximiser'}
  >
    {#if store.maximizedPanelId === nodeId}
      <Minimize2 class="h-3 w-3" />
    {:else}
      <Maximize2 class="h-3 w-3" />
    {/if}
  </button>

  <button
    class="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white"
    onclick={e => {
      e.stopPropagation();
      store.splitPanel(nodeId, 'horizontal');
    }}
    title="Split vertical"
  >
    <Columns2 class="h-3 w-3" />
  </button>
  <button
    class="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white"
    onclick={e => {
      e.stopPropagation();
      store.splitPanel(nodeId, 'vertical');
    }}
    title="Split horizontal"
  >
    <Rows2 class="h-3 w-3" />
  </button>
  <button
    class="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white
           disabled:pointer-events-none disabled:opacity-30"
    onclick={e => {
      e.stopPropagation();
      store.closePanel(nodeId);
    }}
    title="Fermer"
  >
    <X class="h-3 w-3" />
  </button>
</div>
