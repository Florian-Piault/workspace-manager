<script lang="ts">
  import { GitCommit, Loader2, Copy, GitBranchPlus } from '@lucide/svelte';
  import type { GraphCommitInfo, GraphRefInfo, GraphLine } from './types';

  let {
    commits,
    loading,
    onCheckoutRef = async () => {},
    onCopyHash = () => {},
    onCreateBranchFromCommit = async () => {}
  }: {
    commits: GraphCommitInfo[];
    loading: boolean;
    onCheckoutRef?: (target: string) => Promise<void>;
    onCopyHash?: (hash: string) => void;
    onCreateBranchFromCommit?: (hash: string) => Promise<void>;
  } = $props();

  const laneWidth = 12;
  const graphPadding = 8;
  const maxLane = $derived(
    Math.max(
      1,
      ...commits.map((commit) =>
        Math.max(commit.lane, ...commit.lines.map((line) => Math.max(line.from_lane, line.to_lane))) + 1
      )
    )
  );
  const graphWidth = $derived(maxLane * laneWidth + graphPadding * 2);

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

  function refClass(ref: GraphRefInfo): string {
    if (ref.kind === 'head') return 'bg-accent text-accent-foreground';
    if (ref.kind === 'remote') return 'bg-muted text-muted-foreground';
    if (ref.kind === 'tag') return 'bg-secondary text-secondary-foreground';
    return 'bg-primary/15 text-primary';
  }

  function laneColor(lane: number): string {
    const colors = [
      'bg-primary/70',
      'bg-blue-500/70',
      'bg-emerald-500/70',
      'bg-violet-500/70',
      'bg-amber-500/70',
      'bg-rose-500/70'
    ];
    return colors[lane % colors.length] ?? 'bg-primary/70';
  }

  function lineStyle(line: GraphLine): string {
    const left = graphPadding + Math.min(line.from_lane, line.to_lane) * laneWidth;
    const width = Math.max(Math.abs(line.to_lane - line.from_lane) * laneWidth, 2);

    if (line.kind === 'merge' || line.kind === 'horizontal' || line.from_lane !== line.to_lane) {
      return `left:${left}px; top:50%; width:${width}px; height:2px;`;
    }

    return `left:${graphPadding + line.from_lane * laneWidth}px; top:0; width:2px; height:100%;`;
  }

  function lineClass(line: GraphLine): string {
    if (line.kind === 'merge') return `${laneColor(line.to_lane)} rounded-full opacity-90`;
    if (line.kind === 'horizontal') return `${laneColor(line.from_lane)} rounded-full opacity-80`;
    return `${laneColor(line.from_lane)} rounded-full opacity-60`;
  }

  function nodeClass(commit: GraphCommitInfo): string {
    if (commit.node_kind === 'merge') {
      return 'h-2.5 w-2.5 rounded-sm border border-primary/70 bg-primary/30';
    }
    if (commit.node_kind === 'head') {
      return 'h-2.5 w-2.5 rounded-full border border-primary bg-primary/80 shadow-[0_0_0_2px_rgba(120,120,255,0.15)]';
    }
    return 'h-2 w-2 rounded-full border border-border bg-background';
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
      <div class="group flex border-b border-border/40 hover:bg-muted/30 transition-colors">
        <div class="relative shrink-0" style={`width:${graphWidth}px;`}>
          <div class="relative h-full min-h-[52px]">
            {#each commit.lines as line, index}
              <div
                data-testid={`graph-line-${commit.hash}-${index}`}
                data-line-kind={line.kind}
                class={`absolute ${lineClass(line)}`}
                style={lineStyle(line)}
              ></div>
            {/each}

            <div
              data-testid={`graph-node-${commit.hash}`}
              data-node-kind={commit.node_kind}
              class={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${nodeClass(commit)}`}
              style={`left:${graphPadding + commit.lane * laneWidth + 1}px;`}
            ></div>
          </div>
        </div>

        <div class="min-w-0 flex-1 py-2 pr-3">
          <div class="flex min-w-0 items-start gap-2">
            <span class="shrink-0 font-mono text-[10px] text-muted-foreground/50 tabular-nums">
              {commit.short_hash}
            </span>

            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                <span class="min-w-0 truncate text-xs font-medium text-foreground" title={commit.message}>
                  {commit.message}
                </span>

                {#if commit.refs.length > 0}
                  <div class="flex flex-wrap items-center gap-1">
                    {#each commit.refs as ref}
                      {#if ref.checkout_target}
                        <button
                          onclick={() => onCheckoutRef(ref.checkout_target!)}
                          aria-label={`checkout ${ref.name}`}
                          class={`rounded px-1 py-0.5 font-mono text-[9px] font-medium transition-opacity hover:opacity-80 ${refClass(ref)}`}
                        >
                          {ref.name}
                        </button>
                      {:else}
                        <span class={`rounded px-1 py-0.5 font-mono text-[9px] font-medium ${refClass(ref)}`}>
                          {ref.name}
                        </span>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="mt-1 flex flex-wrap items-center gap-2">
                <span class="text-[10px] text-muted-foreground/50">{commit.author_name}</span>
                <span class="text-[10px] text-muted-foreground/30">·</span>
                <span class="text-[10px] text-muted-foreground/40" title={fullDate(commit.timestamp)}>
                  {timeAgo(commit.timestamp)}
                </span>

                <div class="ml-auto flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                  <button
                    onclick={() => onCopyHash(commit.hash)}
                    aria-label={`copy hash ${commit.short_hash}`}
                    class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Copy class="h-3 w-3" />
                  </button>
                  <button
                    onclick={() => onCreateBranchFromCommit(commit.hash)}
                    aria-label={`create branch from ${commit.short_hash}`}
                    class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <GitBranchPlus class="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>
