<script lang="ts">
  import { Plus, Minus, CheckSquare } from '@lucide/svelte';
  import type { FileStatus, SelectedFile } from './types';

  let {
    staged,
    unstaged,
    untracked,
    selectedFile,
    loading,
    onSelect,
    onStage,
    onUnstage,
    onStageAll,
    onUnstageAll
  }: {
    staged: FileStatus[];
    unstaged: FileStatus[];
    untracked: FileStatus[];
    selectedFile: SelectedFile | null;
    loading: boolean;
    onSelect: (path: string, isStaged: boolean) => void;
    onStage: (path: string) => void;
    onUnstage: (path: string) => void;
    onStageAll: () => void;
    onUnstageAll: () => void;
  } = $props();

  const STATUS_COLOR: Record<string, string> = {
    M: 'text-secondary-foreground',
    A: 'text-primary',
    D: 'text-destructive',
    R: 'text-accent-foreground',
    '?': 'text-muted-foreground'
  };

  const totalChanges = $derived(staged.length + unstaged.length + untracked.length);

  function isSelected(path: string, isStaged: boolean) {
    return selectedFile?.path === path && selectedFile?.staged === isStaged;
  }
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
  {#if loading}
    <!-- Skeleton -->
    <div class="flex flex-col gap-1 p-2">
      {#each [40, 65, 55, 70] as w}
        <div class="h-5 animate-pulse rounded bg-muted" style="width: {w}%"></div>
      {/each}
    </div>
  {:else if totalChanges === 0}
    <!-- Clean state -->
    <div class="flex h-full flex-col items-center justify-center gap-1.5">
      <CheckSquare class="h-5 w-5 text-muted-foreground/30" />
      <span class="text-xs text-muted-foreground/50">Rien à committer</span>
    </div>
  {:else}
    <!-- Staged -->
    {#if staged.length > 0}
      <div class="flex items-center justify-between px-2 py-1.5">
        <span class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/50">
          Staged ({staged.length})
        </span>
        <button
          onclick={onUnstageAll}
          aria-label="Dé-stager tout"
          class="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          Tout dé-stager
        </button>
      </div>
      {#each staged as f (f.path)}
        <div
          role="button"
          tabindex="0"
          onclick={() => onSelect(f.path, true)}
          onkeydown={(e) => e.key === 'Enter' && onSelect(f.path, true)}
          class="group flex cursor-pointer items-center gap-1.5 border-l-2 border-primary px-2 py-1 text-xs
                 transition-colors hover:bg-muted/60
                 {isSelected(f.path, true) ? 'bg-muted' : ''}"
        >
          <span class="w-3 shrink-0 font-mono text-[10px] font-bold {STATUS_COLOR[f.status] ?? 'text-muted-foreground'}">
            {f.status}
          </span>
          <span class="min-w-0 flex-1 truncate font-mono text-foreground" title={f.path}>
            {f.path}
          </span>
          <button
            onclick={(e) => { e.stopPropagation(); onUnstage(f.path); }}
            aria-label="Dé-stager {f.path}"
            class="shrink-0 text-muted-foreground opacity-0 transition-all
                   group-hover:opacity-100 hover:text-foreground"
          >
            <Minus class="h-3 w-3" />
          </button>
        </div>
      {/each}
    {/if}

    <!-- Unstaged -->
    {#if unstaged.length > 0}
      <div class="flex items-center justify-between px-2 py-1.5 {staged.length > 0 ? 'mt-1' : ''}">
        <span class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/50">
          Modifiés ({unstaged.length})
        </span>
        <button
          onclick={onStageAll}
          aria-label="Stager tout"
          class="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          Tout stager
        </button>
      </div>
      {#each unstaged as f (f.path)}
        <div
          role="button"
          tabindex="0"
          onclick={() => onSelect(f.path, false)}
          onkeydown={(e) => e.key === 'Enter' && onSelect(f.path, false)}
          class="group flex cursor-pointer items-center gap-1.5 border-l-2 border-border px-2 py-1 text-xs
                 transition-colors hover:bg-muted/60
                 {isSelected(f.path, false) ? 'bg-muted' : ''}"
        >
          <span class="w-3 shrink-0 font-mono text-[10px] font-bold {STATUS_COLOR[f.status] ?? 'text-muted-foreground'}">
            {f.status}
          </span>
          <span class="min-w-0 flex-1 truncate font-mono text-foreground" title={f.path}>
            {f.path}
          </span>
          <button
            onclick={(e) => { e.stopPropagation(); onStage(f.path); }}
            aria-label="Stager {f.path}"
            class="shrink-0 text-muted-foreground opacity-0 transition-all
                   group-hover:opacity-100 hover:text-primary"
          >
            <Plus class="h-3 w-3" />
          </button>
        </div>
      {/each}
    {/if}

    <!-- Untracked -->
    {#if untracked.length > 0}
      <div class="mt-1 flex items-center justify-between px-2 py-1.5">
        <span class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/50">
          Non suivis ({untracked.length})
        </span>
      </div>
      {#each untracked as f (f.path)}
        <div
          class="group flex items-center gap-1.5 border-l-2 border-border/40 px-2 py-1 text-xs"
        >
          <span class="w-3 shrink-0 font-mono text-[10px] font-bold text-muted-foreground">?</span>
          <span class="min-w-0 flex-1 truncate font-mono text-muted-foreground/70" title={f.path}>
            {f.path}
          </span>
          <button
            onclick={() => onStage(f.path)}
            aria-label="Stager {f.path}"
            class="shrink-0 text-muted-foreground opacity-0 transition-all
                   group-hover:opacity-100 hover:text-primary"
          >
            <Plus class="h-3 w-3" />
          </button>
        </div>
      {/each}
    {/if}
  {/if}
</div>
