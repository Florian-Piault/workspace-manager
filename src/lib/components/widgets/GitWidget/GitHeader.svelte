<script lang="ts">
  import { GitBranch, RefreshCw, Download, Upload, ArrowDownToLine } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  let {
    branch,
    ahead,
    behind,
    networkOp,
    onRefresh,
    onFetch,
    onPull,
    onPush,
    pillControls
  }: {
    branch: string;
    ahead: number;
    behind: number;
    networkOp: string | null;
    onRefresh: () => void;
    onFetch: () => Promise<void>;
    onPull: () => Promise<void>;
    onPush: () => Promise<void>;
    pillControls?: Snippet;
  } = $props();

  let spinning = $state(false);

  async function handleRefresh() {
    spinning = true;
    onRefresh();
    setTimeout(() => (spinning = false), 500);
  }
</script>

<div class="flex h-8 shrink-0 items-center gap-1.5 border-b border-border bg-muted/40 px-2">
  <!-- Branch info -->
  <GitBranch class="h-3 w-3 shrink-0 text-muted-foreground" />
  <span class="min-w-0 max-w-[120px] truncate font-mono text-xs font-medium text-foreground">
    {branch}
  </span>

  {#if ahead > 0}
    <span class="font-mono text-[10px] text-muted-foreground" title="{ahead} commit(s) en avance">↑{ahead}</span>
  {/if}
  {#if behind > 0}
    <span class="font-mono text-[10px] text-muted-foreground" title="{behind} commit(s) en retard">↓{behind}</span>
  {/if}

  <div class="ml-auto flex items-center gap-0.5">
    <!-- Fetch -->
    <button
      onclick={onFetch}
      disabled={!!networkOp}
      aria-label="Fetch"
      title="git fetch"
      class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground
             hover:bg-accent hover:text-accent-foreground transition-colors
             disabled:opacity-40 disabled:cursor-not-allowed
             {networkOp === 'fetch' ? 'animate-pulse' : ''}"
    >
      <ArrowDownToLine class="h-3 w-3" />
    </button>

    <!-- Pull -->
    <button
      onclick={onPull}
      disabled={!!networkOp}
      aria-label="Pull"
      title="git pull"
      class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground
             hover:bg-accent hover:text-accent-foreground transition-colors
             disabled:opacity-40 disabled:cursor-not-allowed
             {networkOp === 'pull' ? 'animate-pulse' : ''}"
    >
      <Download class="h-3 w-3" />
    </button>

    <!-- Push -->
    <button
      onclick={onPush}
      disabled={!!networkOp || ahead === 0}
      aria-label="Push"
      title="git push"
      class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground
             hover:bg-accent hover:text-accent-foreground transition-colors
             disabled:opacity-40 disabled:cursor-not-allowed
             {networkOp === 'push' ? 'animate-pulse' : ''}"
    >
      <Upload class="h-3 w-3" />
    </button>

    <!-- Refresh -->
    <button
      onclick={handleRefresh}
      aria-label="Rafraîchir"
      title="Rafraîchir"
      class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground
             hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <RefreshCw class="h-3 w-3 transition-transform duration-500 {spinning ? 'rotate-180' : ''}" />
    </button>

    {#if pillControls}
      <div class="ml-0.5 border-l border-border pl-1">
        {@render pillControls()}
      </div>
    {/if}
  </div>
</div>
