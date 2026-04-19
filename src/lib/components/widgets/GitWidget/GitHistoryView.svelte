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

  // Distinguish HEAD, local branches, remote branches, tags
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
    {#each commits as commit (commit.hash)}
      <div class="group border-b border-border/40 px-3 py-2 hover:bg-muted/30 transition-colors">
        <!-- First line: hash + message + refs -->
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
                <span
                  class="rounded px-1 py-0.5 font-mono text-[9px] font-medium {refClass(ref)}"
                >
                  {ref}
                </span>
              {/each}
            </div>
          {/if}
        </div>
        <!-- Second line: author + time -->
        <div class="mt-0.5 flex items-center gap-1.5">
          <span class="text-[10px] text-muted-foreground/50">{commit.author_name}</span>
          <span class="text-[10px] text-muted-foreground/30">·</span>
          <span class="text-[10px] text-muted-foreground/40">{timeAgo(commit.timestamp)}</span>
        </div>
      </div>
    {/each}
  {/if}
</div>
