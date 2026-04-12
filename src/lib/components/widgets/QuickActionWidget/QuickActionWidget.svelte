<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Plus,
    Pin,
    PinOff,
    ChevronDown,
    ChevronUp,
    ScanSearch
  } from '@lucide/svelte';
  import NpmIcon from '$lib/components/ui/icon/Npm.svelte';
  import PnpmIcon from '$lib/components/ui/icon/PnpmIcon.svelte';
  import BunIcon from '$lib/components/ui/icon/BunIcon.svelte';
  import MakeIcon from '$lib/components/ui/icon/MakeIcon.svelte';
  import DockerIcon from '$lib/components/ui/icon/DockerIcon.svelte';
  import RustIcon from '$lib/components/ui/icon/RustIcon.svelte';
  import BashIcon from '$lib/components/ui/icon/BashIcon.svelte';
  import type { Snippet } from 'svelte';
  import { store } from '$lib/state.svelte';
  import { qaStore, type DetectedAction } from '$lib/quick_actions.svelte';
  import QuickActionItem from './QuickActionItem.svelte';
  import QuickActionForm from './QuickActionForm.svelte';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TOOL_ICONS: Record<string, any> = {
    npm: NpmIcon,
    pnpm: PnpmIcon,
    bun: BunIcon,
    make: MakeIcon,
    docker: DockerIcon,
    cargo: RustIcon,
    shell: BashIcon
  };

  let { nodeId, pillControls }: { config: Record<string, unknown>; nodeId: string; pillControls?: Snippet } =
    $props();

  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let showDetected = $state(true);

  const workspaceId = $derived(store.activeWorkspaceId);
  const workspacePath = $derived(store.activeWorkspace?.path ?? '/');

  const actions = $derived(
    qaStore.actions.filter(a => a.workspaceId === workspaceId)
  );

  const detectedActions = $derived(qaStore.detectedActions);

  const editingAction = $derived(
    editingId ? (actions.find(a => a.id === editingId) ?? null) : null
  );

  let lastScannedPath = $state('');

  onMount(async () => {
    if (workspaceId) await qaStore.loadForWorkspace(workspaceId);
    if (workspacePath && workspacePath !== '/') {
      lastScannedPath = workspacePath;
      await qaStore.scanWorkspace(workspacePath);
    }
  });

  // Re-scan when workspace path changes
  $effect(() => {
    const path = workspacePath;
    if (path && path !== '/' && path !== lastScannedPath) {
      lastScannedPath = path;
      qaStore.scanWorkspace(path);
    }
  });

  onDestroy(() => {
    for (const action of actions) {
      const status = qaStore.statuses.get(action.id);
      if (status === 'running') qaStore.killProcess(action.id);
    }
  });

  function startEdit(id: string) {
    editingId = id;
    showForm = false;
  }

  function cancelForm() {
    showForm = false;
    editingId = null;
  }

  async function handleAdd(
    label: string,
    command: string,
    args: string[],
    cwd: string | null
  ) {
    if (!workspaceId) return;
    await qaStore.create(workspaceId, label, command, args, cwd);
    showForm = false;
  }

  async function handleUpdate(
    label: string,
    command: string,
    args: string[],
    cwd: string | null
  ) {
    if (!editingId) return;
    await qaStore.update(editingId, label, command, args, cwd);
    editingId = null;
  }

  async function pinAction(detected: DetectedAction) {
    if (!workspaceId) return;
    await qaStore.create(
      workspaceId,
      detected.label,
      detected.command,
      [],
      null
    );
    if (workspacePath && workspacePath !== '/')
      await qaStore.scanWorkspace(workspacePath);
  }

  async function unpinAction(detected: DetectedAction) {
    const matching = actions.find(
      a => a.command === detected.command && a.args.length === 0
    );
    if (!matching) return;
    await qaStore.delete(matching.id);
    if (workspacePath && workspacePath !== '/')
      await qaStore.scanWorkspace(workspacePath);
  }
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
  <!-- Header -->
  <div
    class="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3"
  >
    <span class="flex-1 text-xs font-semibold text-foreground">Quick Actions</span>
    <button
      onclick={() => {
        showForm = !showForm;
        editingId = null;
      }}
      title="Ajouter une action"
      class="flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Plus class="h-3.5 w-3.5" />
    </button>

    {#if pillControls}
      <div class="shrink-0 border-l border-border pl-2">
        {@render pillControls()}
      </div>
    {/if}
  </div>

  <!-- Liste des actions -->
  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#if actions.length === 0 && detectedActions.length === 0 && !showForm}
      <div class="flex h-full items-center justify-center">
        <div class="flex flex-col items-center gap-2 text-center">
          <span class="text-sm text-muted-foreground"
            >Aucune action configurée.</span
          >
          <button
            onclick={() => (showForm = true)}
            class="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Ajouter une action
          </button>
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        {#each actions as action (action.id)}
          <QuickActionItem
            {action}
            status={qaStore.statuses.get(action.id) ?? 'idle'}
            logs={qaStore.logs.get(action.id) ?? []}
            onRun={() => qaStore.execute(action, workspacePath)}
            onKill={() => qaStore.killProcess(action.id)}
            onDelete={() => qaStore.delete(action.id)}
            onEdit={() => startEdit(action.id)}
          />
        {/each}
      </div>

      <!-- Detected Actions -->
      {#if detectedActions.length > 0}
        <div class="mt-3">
          <button
            onclick={() => (showDetected = !showDetected)}
            class="flex w-full items-center gap-1.5 px-1 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ScanSearch class="h-3 w-3" />
            <span>Commandes détectées ({detectedActions.length})</span>
            {#if showDetected}
              <ChevronUp class="ml-auto h-3 w-3" />
            {:else}
              <ChevronDown class="ml-auto h-3 w-3" />
            {/if}
          </button>

          {#if showDetected}
            <div class="flex flex-col gap-1 mt-1">
              {#each detectedActions as detected (detected.id)}
                <div
                  class="flex items-center gap-2 rounded border px-2 py-1.5 transition-colors {detected.isPinned
                    ? 'border-border/30 bg-muted/30'
                    : 'border-border/50 bg-card/50'}"
                >
                  <!-- Source icon -->
                  <div
                    class="shrink-0 flex h-5 w-5 items-center justify-center rounded bg-muted"
                  >
                    {#if TOOL_ICONS[detected.icon]}
                      {@const Icon = TOOL_ICONS[detected.icon]}
                      <Icon size={13} />
                    {:else}
                      <span
                        class="text-[10px] font-mono font-semibold text-muted-foreground leading-none"
                      >
                        {detected.icon}
                      </span>
                    {/if}
                  </div>

                  <!-- Label + command -->
                  <div class="min-w-0 flex-1">
                    <span
                      class="block truncate text-xs font-medium {detected.isPinned
                        ? 'text-muted-foreground'
                        : ''}">{detected.label}</span
                    >
                    <span
                      class="block truncate text-xs text-muted-foreground/60"
                      >{detected.command}</span
                    >
                  </div>

                  <!-- Pin / Unpin button -->
                  {#if detected.isPinned}
                    <button
                      onclick={() => unpinAction(detected)}
                      title="Dépingler cette action"
                      class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-primary/60 hover:bg-accent hover:text-destructive transition-colors"
                    >
                      <PinOff class="h-3 w-3" />
                    </button>
                  {:else}
                    <button
                      onclick={() => pinAction(detected)}
                      title="Épingler cette action"
                      class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Pin class="h-3 w-3" />
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Formulaire ajout -->
  {#if showForm}
    <QuickActionForm onSubmit={handleAdd} onCancel={cancelForm} />
  {/if}

  <!-- Formulaire édition -->
  {#if editingAction}
    <QuickActionForm
      title="Modifier l'action"
      initial={{
        label: editingAction.label,
        command: editingAction.command,
        args: editingAction.args.join(' '),
        cwd: editingAction.cwd
      }}
      onSubmit={handleUpdate}
      onCancel={cancelForm}
    />
  {/if}
</div>
