<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { GitBranch, AlertTriangle, Loader2, X, CheckCircle } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import { store } from '$lib/state.svelte';
  import GitHeader from './GitHeader.svelte';
  import GitFileList from './GitFileList.svelte';
  import GitDiffViewer from './GitDiffViewer.svelte';
  import GitBranchPanel from './GitBranchPanel.svelte';
  import GitCommitArea from './GitCommitArea.svelte';
  import GitHistoryView from './GitHistoryView.svelte';
  import type { GitStatus, BranchInfo, AheadBehind, SelectedFile, CommitInfo, OpResult } from './types';

  let { config, nodeId, pillControls }: {
    config: Record<string, unknown>;
    nodeId: string;
    pillControls?: Snippet;
  } = $props();

  const workspacePath = $derived(store.activeWorkspace?.path ?? '');

  let loading = $state(true);
  let historyLoading = $state(false);
  let error = $state<string | null>(null);
  let noRepo = $state(false);
  let networkOp = $state<string | null>(null);
  let opResult = $state<OpResult | null>(null);
  let opResultTimer: ReturnType<typeof setTimeout> | null = null;

  let gitStatus = $state<GitStatus>({ staged: [], unstaged: [], untracked: [] });
  let branches = $state<BranchInfo[]>([]);
  let aheadBehind = $state<AheadBehind>({ ahead: 0, behind: 0 });
  let commits = $state<CommitInfo[]>([]);
  let selectedFile = $state<SelectedFile | null>(null);
  let diffContent = $state<string | null>(null);

  // mainView: Changes vs History tabs
  let mainView = $state<'changes' | 'history'>('changes');
  // narrowMode sub-view (changes list vs diff panel)
  let narrowView = $state<'changes' | 'diff'>('changes');
  let narrowMode = $state(false);

  let container: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  let watchInterval: ReturnType<typeof setInterval> | null = null;

  const currentBranch = $derived(branches.find(b => b.is_current)?.name ?? '—');
  const totalChanges = $derived(gitStatus.staged.length + gitStatus.unstaged.length + gitStatus.untracked.length);

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

  async function loadHistory() {
    if (!workspacePath) return;
    historyLoading = true;
    try {
      commits = await invoke<CommitInfo[]>('git_log', { path: workspacePath, limit: 100 });
    } catch { commits = []; }
    finally { historyLoading = false; }
  }

  async function loadDiff(path: string, staged: boolean) {
    if (!workspacePath) return;
    try {
      diffContent = await invoke<string>('git_diff_file', { path: workspacePath, file: path, staged });
    } catch { diffContent = null; }
  }

  async function selectFile(path: string, staged: boolean) {
    selectedFile = { path, staged };
    if (narrowMode) narrowView = 'diff';
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
      if (mainView === 'history') await loadHistory();
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

  async function deleteRemoteBranch(remote: string, branch: string) {
    if (!workspacePath) return;
    try {
      const output = await invoke<string>('git_delete_remote_branch', {
        path: workspacePath, remote, branch
      });
      showOpResult('push', output || `Branche ${remote}/${branch} supprimée`, true);
      await loadStatus();
    } catch (e) { error = String(e); }
  }

  function showOpResult(op: string, output: string, success: boolean) {
    if (opResultTimer) clearTimeout(opResultTimer);
    opResult = { op, output: output.trim(), success };
    opResultTimer = setTimeout(() => { opResult = null; }, 6000);
  }

  async function netOp(op: string, fn: () => Promise<string>) {
    networkOp = op;
    try {
      const output = await fn();
      await loadStatus();
      if (mainView === 'history') await loadHistory();
      showOpResult(op, output || 'OK', true);
    } catch (e) {
      error = String(e);
    } finally {
      networkOp = null;
    }
  }

  // Load history when switching to that view
  $effect(() => {
    if (mainView === 'history' && workspacePath && commits.length === 0) {
      loadHistory();
    }
  });

  onMount(() => {
    resizeObserver = new ResizeObserver(([entry]) => {
      narrowMode = entry.contentRect.width < 480;
    });
    resizeObserver.observe(container);
    watchInterval = setInterval(loadStatus, 5000);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    if (watchInterval) clearInterval(watchInterval);
    if (opResultTimer) clearTimeout(opResultTimer);
  });

  $effect(() => {
    const path = workspacePath;
    if (path) {
      loading = true;
      noRepo = false;
      selectedFile = null;
      diffContent = null;
      commits = [];
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

  <!-- Op result feedback banner -->
  {#if opResult}
    <div
      class="flex shrink-0 items-center gap-2 border-b px-3 py-1
             {opResult.success
               ? 'border-primary/20 bg-primary/[0.07] text-primary'
               : 'border-destructive/20 bg-destructive/10 text-destructive'}"
      in:fly={{ y: -4, duration: 150 }}
    >
      <CheckCircle class="h-3 w-3 shrink-0" />
      <span class="min-w-0 flex-1 truncate font-mono text-[11px]">
        <span class="font-semibold">{opResult.op}</span>
        {#if opResult.output} — {opResult.output}{/if}
      </span>
      <button
        onclick={() => { opResult = null; }}
        aria-label="Fermer"
        class="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X class="h-3 w-3" />
      </button>
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

  <!-- Network overlay -->
  {:else if networkOp}
    <div class="flex flex-1 flex-col items-center justify-center gap-2">
      <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
      <span class="font-mono text-xs text-muted-foreground capitalize">{networkOp}…</span>
    </div>

  {:else}
    <!-- Tab strip -->
    <div class="flex h-7 shrink-0 items-center border-b border-border bg-muted/20 px-2 gap-1">
      <button
        onclick={() => (mainView = 'changes')}
        class="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-colors
               {mainView === 'changes'
                 ? 'bg-background text-foreground font-medium shadow-sm border border-border/60'
                 : 'text-muted-foreground hover:text-foreground'}"
      >
        Changes
        {#if totalChanges > 0}
          <span class="font-mono text-[10px] {mainView === 'changes' ? 'text-primary' : 'text-muted-foreground/60'}">
            {totalChanges}
          </span>
        {/if}
      </button>
      <button
        onclick={() => { mainView = 'history'; if (commits.length === 0) loadHistory(); }}
        class="rounded px-2 py-0.5 text-[11px] transition-colors
               {mainView === 'history'
                 ? 'bg-background text-foreground font-medium shadow-sm border border-border/60'
                 : 'text-muted-foreground hover:text-foreground'}"
      >
        History
      </button>
    </div>

    <!-- History view -->
    {#if mainView === 'history'}
      <GitHistoryView {commits} loading={historyLoading} />

    <!-- Changes view -->
    {:else if narrowMode}
      <!-- Narrow: single column -->
      {#if narrowView === 'diff' && selectedFile}
        <GitDiffViewer
          content={diffContent}
          file={selectedFile.path}
          staged={selectedFile.staged}
          narrowMode={true}
          onBack={() => { narrowView = 'changes'; }}
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
          onDeleteRemoteBranch={deleteRemoteBranch}
        />
        <GitCommitArea stagedCount={gitStatus.staged.length} onCommit={commit} />
      {/if}

    {:else}
      <!-- Wide: side-by-side -->
      <div class="flex min-h-0 flex-1 overflow-hidden">
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
            onDeleteRemoteBranch={deleteRemoteBranch}
          />
          <GitCommitArea stagedCount={gitStatus.staged.length} onCommit={commit} />
        </div>
        <GitDiffViewer
          content={diffContent}
          file={selectedFile?.path ?? null}
          staged={selectedFile?.staged ?? false}
        />
      </div>
    {/if}
  {/if}
</div>
