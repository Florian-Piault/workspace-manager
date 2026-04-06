<script lang="ts">
  import { Columns2, Rows2, X, Terminal, Code2, Globe } from '@lucide/svelte';
  import { store } from '$lib/state.svelte';
  import type { Widget } from '$lib/types';

  let {
    nodeId,
    widget,
    isRoot = false,
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

  const displayLabel = $derived(widget.label ?? widget.type);
</script>

<div
  class="absolute right-1 top-1 z-10 flex items-center gap-0.5
         rounded-md bg-background/70 px-1.5 py-0.5 backdrop-blur-sm
         opacity-0 transition-opacity group-hover:opacity-100 border border-border/50"
>
  {#if widget.type === 'terminal'}
    <Terminal class="h-3 w-3 text-muted-foreground flex-shrink-0" />
  {:else if widget.type === 'code'}
    <Code2 class="h-3 w-3 text-muted-foreground flex-shrink-0" />
  {:else if widget.type === 'browser'}
    <Globe class="h-3 w-3 text-muted-foreground flex-shrink-0" />
  {/if}

  {#if widget.type !== 'empty'}
    {#if editing}
      <input
        class="w-20 bg-transparent text-xs text-foreground outline-none"
        bind:value={draft}
        onblur={confirmEdit}
        onkeydown={handleKeydown}
        autofocus
      />
    {:else}
      <button
        class="max-w-[80px] truncate text-xs text-muted-foreground hover:text-foreground"
        onclick={startEdit}
        title="Renommer"
      >
        {displayLabel}
      </button>
    {/if}
  {/if}

  <div class="mx-0.5 h-3 w-px bg-border/50"></div>

  <button
    class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    onclick={(e) => { e.stopPropagation(); store.splitPanel(nodeId, 'horizontal'); }}
    title="Split vertical"
  >
    <Columns2 class="h-3 w-3" />
  </button>
  <button
    class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    onclick={(e) => { e.stopPropagation(); store.splitPanel(nodeId, 'vertical'); }}
    title="Split horizontal"
  >
    <Rows2 class="h-3 w-3" />
  </button>
  <button
    class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground
           disabled:pointer-events-none disabled:opacity-30"
    disabled={isRoot}
    onclick={(e) => { e.stopPropagation(); store.closePanel(nodeId); }}
    title="Fermer"
  >
    <X class="h-3 w-3" />
  </button>
</div>
