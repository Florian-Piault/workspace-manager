<script lang="ts">
  import { Code2, Terminal, Globe } from '@lucide/svelte';
  import { store } from '$lib/state.svelte';
  import type { WidgetType } from '$lib/types';

  let { nodeId }: { nodeId: string } = $props();

  const items: { type: Exclude<WidgetType, 'empty'>; label: string; icon: typeof Code2 }[] = [
    { type: 'code', label: 'Code Editor', icon: Code2 },
    { type: 'terminal', label: 'Terminal', icon: Terminal },
    { type: 'browser', label: 'Browser', icon: Globe },
  ];
</script>

<div class="flex h-full w-full items-center justify-center">
  <div class="flex flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-sm">
    {#each items as item}
      <button
        class="flex items-center gap-3 rounded px-4 py-2 text-sm text-muted-foreground
               transition-colors hover:bg-accent hover:text-accent-foreground"
        onclick={() => store.assignWidget(nodeId, item.type)}
      >
        <item.icon class="h-4 w-4 shrink-0" />
        {item.label}
      </button>
    {/each}
  </div>
</div>
