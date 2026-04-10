<script lang="ts">
  import { Play, Square, Trash2, ChevronDown, ChevronUp, Pencil } from '@lucide/svelte';
  import type { QuickAction, ActionStatus } from '$lib/quick_actions.svelte';

  let {
    action,
    status,
    logs,
    onRun,
    onKill,
    onDelete,
    onEdit
  }: {
    action: QuickAction;
    status: ActionStatus;
    logs: string[];
    onRun: () => void;
    onKill: () => void;
    onDelete: () => void;
    onEdit: () => void;
  } = $props();

  let showLogs = $state(false);

  const statusClass = $derived({
    idle: 'bg-muted text-muted-foreground',
    running: 'bg-blue-500/20 text-blue-400',
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-destructive/20 text-destructive',
  }[status]);

  const statusLabel = $derived({
    idle: 'IDLE',
    running: 'RUN',
    success: 'OK',
    error: 'ERR',
  }[status]);
</script>

<div class="flex flex-col rounded border border-border bg-card">
  <div class="flex items-center gap-2 px-2 py-1.5">
    <!-- Play / Stop -->
    {#if status === 'running'}
      <button
        onclick={onKill}
        title="Arrêter"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Square class="h-3 w-3" />
      </button>
    {:else}
      <button
        onclick={onRun}
        title="Lancer"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Play class="h-3 w-3" />
      </button>
    {/if}

    <!-- Label + commande -->
    <div class="min-w-0 flex-1">
      <span class="block truncate text-xs font-medium">{action.label}</span>
      <span class="block truncate text-xs text-muted-foreground/60">
        {action.command}{action.args.length ? ' ' + action.args.join(' ') : ''}
      </span>
    </div>

    <!-- Status badge -->
    <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold {statusClass}">
      {statusLabel}
    </span>

    <!-- Logs toggle -->
    <button
      onclick={() => (showLogs = !showLogs)}
      title="Afficher les logs"
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {#if showLogs}
        <ChevronUp class="h-3 w-3" />
      {:else}
        <ChevronDown class="h-3 w-3" />
      {/if}
    </button>

    <!-- Edit -->
    <button
      onclick={onEdit}
      title="Modifier"
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Pencil class="h-3 w-3" />
    </button>

    <!-- Delete -->
    <button
      onclick={onDelete}
      title="Supprimer"
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
    >
      <Trash2 class="h-3 w-3" />
    </button>
  </div>

  <!-- Logs panel -->
  {#if showLogs}
    <div class="max-h-32 overflow-y-auto border-t border-border bg-black/40 px-2 py-1">
      {#if logs.length === 0}
        <span class="text-xs text-muted-foreground/40">Aucun log.</span>
      {:else}
        {#each logs.slice(-100) as line}
          <pre class="text-[10px] leading-4 text-foreground/80 whitespace-pre-wrap break-all">{line}</pre>
        {/each}
      {/if}
    </div>
  {/if}
</div>
