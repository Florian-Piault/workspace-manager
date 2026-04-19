<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { GitBranch, AlertTriangle, Loader2, X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { store } from '$lib/state.svelte';
  import GitHeader from './GitHeader.svelte';
  import GitFileList from './GitFileList.svelte';
  import GitDiffViewer from './GitDiffViewer.svelte';
  import GitBranchPanel from './GitBranchPanel.svelte';
  import GitCommitArea from './GitCommitArea.svelte';
  import type { GitStatus, BranchInfo, AheadBehind, SelectedFile } from './types';

  let { config, nodeId, pillControls }: {
    config: Record<string, unknown>;
    nodeId: string;
    pillControls?: Snippet;
  } = $props();

  const workspacePath = $derived(store.activeWorkspace?.path ?? '');

  let loading = $state(true);
  let error = $state<string | null>(null);
  let noRepo = $state(false);
  let networkOp = $state<string | null>(null);

  let gitStatus = $state<GitStatus>({ staged: [], unstaged: [], untracked: [] });
  let branches = $state<BranchInfo[]>([]);
  let aheadBehind = $state<AheadBehind>({ ahead: 0, behind: 0 });
  let selectedFile = $state<SelectedFile | null>(null);
  let diffContent = $state<string | null>(null);

  let narrowMode = $state(false);
  let view = $state<'changes' | 'diff'>('changes');

  let container: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  let watchInterval: ReturnType<typeof setInterval> | null = null;

  const currentBranch = $derived(
    branches.find(b => b.is_current)?.name ?? '—'
  );

  async function loadStatus() {
    if (!workspacePath) return;
    try {
      const [status, branchList, ab] = await Promise.all([
        invoke<GitStatus>('git_status', { path: workspacePath }),
        invoke<BranchInfo[]>('git_branches', { path: workspacePath }),
        invoke<AheadBehind>('git_ahead_behind', { path: workspacePath })
      ]);
      gitStatus = status;
      branches = branchList;
      aheadBehind = ab;
      noRepo = false;
      error = null;
    } catch (e) {
      const msg = String(e);
      if (msg.includes('could not find') || msg.includes('not a git')) {
        noRepo = true;
      } else {
        error = msg;
      }
    } finally {
      loading = false;
    }
  }

  async function loadDiff(path: string, staged: boolean) {
    if (!workspacePath) return;
    try {
      diffContent = await invoke<string>('git_diff_file', {
        path: workspacePath,
        file: path,
        staged
      });
    } catch {
      diffContent = null;
    }
  }

  async function selectFile(path: string, staged: boolean) {
    selectedFile = { path, staged };
    if (narrowMode) view = 'diff';
    await loadDiff(path, staged);
  }

  async function stage(path: string) {
    if (!workspacePath) return;
    try {
      await invoke('git_stage', { path: workspacePath, files: [path] });
      await loadStatus();
      if (selectedFile?.path === path) await loadDiff(path, true);
    } catch (e) { error = String(e); }
  }

  async function unstage(path: string) {
    if (!workspacePath) return;
    try {
      await invoke('git_unstage', { path: workspacePath, files: [path] });
      await loadStatus();
      if (selectedFile?.path === path) await loadDiff(path, false);
    } catch (e) { error = String(e); }
  }

  async function stageAll() {
    if (!workspacePath) return;
    const paths = [...gitStatus.unstaged, ...gitStatus.untracked].map(f => f.path);
    if (!paths.length) return;
    try {
      await invoke('git_stage', { path: workspacePath, files: paths });
      await loadStatus();
    } catch (e) { error = String(e); }
  }

  async function unstageAll() {
    if (!workspacePath) return;
    const paths = gitStatus.staged.map(f => f.path);
    if (!paths.length) return;
    try {
      await invoke('git_unstage', { path: workspacePath, files: paths });
      await loadStatus();
    } catch (e) { error = String(e); }
  }

  async function commit(message: string) {
    if (!workspacePath) return;
    try {
      await invoke('git_commit', { path: workspacePath, message });
      selectedFile = null;
      diffContent = null;
      await loadStatus();
    } catch (e) { error = String(e); }
  }

  async function checkout(branch: string) {
    if (!workspacePath) return;
    try {
      await invoke('git_checkout', { path: workspacePath, branch });
      await loadStatus();
    } catch (e) { error = String(e); }
  }

  async function createBranch(name: string) {
    if (!workspacePath) return;
    try {
      await invoke('git_create_branch', { path: workspacePath, name });
      await loadStatus();
    } catch (e) { error = String(e); }
  }

  async function deleteBranch(name: string) {
    if (!workspacePath) return;
    try {
      await invoke('git_delete_branch', { path: workspacePath, name });
      await loadStatus();
    } catch (e) { error = String(e); }
  }

  async function netOp(op: string, fn: () => Promise<unknown>) {
    networkOp = op;
    try {
      await fn();
      await loadStatus();
    } catch (e) { error = String(e); }
    finally { networkOp = null; }
  }

  onMount(() => {
    // Narrow mode detection
    resizeObserver = new ResizeObserver(([entry]) => {
      narrowMode = entry.contentRect.width < 480;
    });
    resizeObserver.observe(container);

    // Poll for git changes every 5s
    watchInterval = setInterval(loadStatus, 5000);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    if (watchInterval) clearInterval(watchInterval);
  });

  $effect(() => {
    // Reload when workspace changes
    const path = workspacePath;
    if (path) {
      loading = true;
      noRepo = false;
      selectedFile = null;
      diffContent = null;
      loadStatus();
    }
  });
</script>

<div bind:this={container} class="flex h-full w-full flex-col overflow-hidden">
  <!-- Header -->
  {#if !noRepo}
    <GitHeader
      branch={currentBranch}
      ahead={aheadBehind.ahead}
      behind={aheadBehind.behind}
      {networkOp}
      onRefresh={loadStatus}
      onFetch={() => netOp('fetch', () => invoke('git_fetch', { path: workspacePath }))}
      onPull={() => netOp('pull', () => invoke('git_pull', { path: workspacePath }))}
      onPush={() => netOp('push', () => invoke('git_push', { path: workspacePath }))}
      {pillControls}
    />
  {:else}
    <div class="flex h-8 shrink-0 items-center border-b border-border bg-muted/40 px-2">
      {#if pillControls}
        <div class="ml-auto">{@render pillControls()}</div>
      {/if}
    </div>
  {/if}

  <!-- Error banner -->
  {#if error}
    <div class="flex shrink-0 items-center gap-2 border-b border-destructive/20
                bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
      <AlertTriangle class="h-3 w-3 shrink-0" />
      <span class="min-w-0 flex-1 truncate font-mono">{error}</span>
      <button onclick={() => (error = null)} aria-label="Fermer l'erreur">
        <X class="h-3 w-3" />
      </button>
    </div>
  {/if}

  <!-- No repo state -->
  {#if noRepo}
    <div class="flex flex-1 flex-col items-center justify-center gap-2">
      <GitBranch class="h-8 w-8 text-muted-foreground/20" />
      <span class="text-sm text-muted-foreground/50">Pas de dépôt Git</span>
      <span class="text-xs text-muted-foreground/30">{workspacePath}</span>
    </div>

  <!-- Network operation overlay -->
  {:else if networkOp}
    <div class="flex flex-1 flex-col items-center justify-center gap-2">
      <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
      <span class="font-mono text-xs text-muted-foreground capitalize">{networkOp}…</span>
    </div>

  <!-- Main content -->
  {:else if narrowMode}
    <!-- Narrow: single column -->
    {#if view === 'diff' && selectedFile}
      <GitDiffViewer
        content={diffContent}
        file={selectedFile.path}
        staged={selectedFile.staged}
        narrowMode={true}
        onBack={() => { view = 'changes'; }}
      />
    {:else}
      <GitFileList
        staged={gitStatus.staged}
        unstaged={gitStatus.unstaged}
        untracked={gitStatus.untracked}
        {selectedFile}
        {loading}
        onSelect={selectFile}
        onStage={stage}
        onUnstage={unstage}
        onStageAll={stageAll}
        onUnstageAll={unstageAll}
      />
      <GitBranchPanel
        {branches}
        onCheckout={checkout}
        onCreateBranch={createBranch}
        onDeleteBranch={deleteBranch}
      />
      <GitCommitArea stagedCount={gitStatus.staged.length} onCommit={commit} />
    {/if}

  {:else}
    <!-- Wide: side-by-side -->
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Left rail -->
      <div class="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border">
        <GitFileList
          staged={gitStatus.staged}
          unstaged={gitStatus.unstaged}
          untracked={gitStatus.untracked}
          {selectedFile}
          {loading}
          onSelect={selectFile}
          onStage={stage}
          onUnstage={unstage}
          onStageAll={stageAll}
          onUnstageAll={unstageAll}
        />
        <GitBranchPanel
          {branches}
          onCheckout={checkout}
          onCreateBranch={createBranch}
          onDeleteBranch={deleteBranch}
        />
        <GitCommitArea stagedCount={gitStatus.staged.length} onCommit={commit} />
      </div>

      <!-- Diff panel -->
      <GitDiffViewer
        content={diffContent}
        file={selectedFile?.path ?? null}
        staged={selectedFile?.staged ?? false}
      />
    </div>
  {/if}
</div>
