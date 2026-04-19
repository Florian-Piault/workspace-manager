<script lang="ts">
  import { GitCommit, Loader2 } from '@lucide/svelte';
  import type { CommitInfo } from './types';

  let {
    commits,
    loading
  }: {
    commits: CommitInfo[];
    loading: boolean;
  } = $props();

  function timeAgo(timestamp: number): string {
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 60) return 'à l\'instant';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}j`;
    if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}sem`;
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });
  }

  function fullDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function refClass(ref: string): string {
    if (ref === 'HEAD') return 'bg-accent text-accent-foreground';
    if (ref.startsWith('origin/')) return 'bg-muted text-muted-foreground';
    return 'bg-primary/15 text-primary';
  }
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
  {#if loading}
    <div class="flex flex-col items-center justify-center gap-2 pt-8">
      <Loader2 class="h-4 w-4 animate-spin text-muted-foreground/40" />
    </div>
  {:else if commits.length === 0}
    <div class="flex h-full flex-col items-center justify-center gap-2">
      <GitCommit class="h-5 w-5 text-muted-foreground/20" />
      <span class="text-xs text-muted-foreground/40">Aucun commit</span>
    </div>
  {:else}
    {#each commits as commit, i (commit.hash)}
      {@const isMerge = commit.parent_count >= 2}
      {@const isLast = i === commits.length - 1}
      <div class="group flex border-b border-border/40 hover:bg-muted/30 transition-colors">
        <!-- Graph column -->
        <div class="relative flex w-6 shrink-0 flex-col items-center">
          <!-- Top connector -->
          {#if i > 0}
            <div class="w-px flex-1 bg-border/50" style="min-height: 10px; max-height: 12px;"></div>
          {:else}
            <div class="flex-1" style="min-height: 10px; max-height: 12px;"></div>
          {/if}
          <!-- Node -->
          {#if isMerge}
            <div class="h-2.5 w-2.5 shrink-0 rounded-sm border border-primary/60 bg-primary/30"></div>
          {:else}
            <div class="h-2 w-2 shrink-0 rounded-full border border-border bg-background"></div>
          {/if}
          <!-- Bottom connector -->
          {#if !isLast}
            <div class="w-px flex-1 bg-border/50"></div>
          {:else}
            <div class="flex-1"></div>
          {/if}
        </div>

        <!-- Commit info -->
        <div class="min-w-0 flex-1 py-2 pr-3">
          <div class="flex min-w-0 items-baseline gap-2">
            <span class="shrink-0 font-mono text-[10px] text-muted-foreground/50 tabular-nums">
              {commit.short_hash}
            </span>
            <span class="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={commit.message}>
              {commit.message}
            </span>
            {#if commit.refs.length > 0}
              <div class="flex shrink-0 items-center gap-1">
                {#each commit.refs as ref}
                  <span class="rounded px-1 py-0.5 font-mono text-[9px] font-medium {refClass(ref)}">
                    {ref}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
          <div class="mt-0.5 flex items-center gap-1.5">
            <span class="text-[10px] text-muted-foreground/50">{commit.author_name}</span>
            <span class="text-[10px] text-muted-foreground/30">·</span>
            <span
              class="text-[10px] text-muted-foreground/40"
              title={fullDate(commit.timestamp)}
            >{timeAgo(commit.timestamp)}</span>
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>
