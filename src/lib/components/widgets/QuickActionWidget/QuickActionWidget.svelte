<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Plus } from '@lucide/svelte';
  import { store } from '$lib/state.svelte';
  import { qaStore } from '$lib/quick_actions.svelte';
  import QuickActionItem from './QuickActionItem.svelte';
  import QuickActionForm from './QuickActionForm.svelte';

  let { nodeId }: { config: Record<string, unknown>; nodeId: string } = $props();

  let showForm = $state(false);
  let editingId = $state<string | null>(null);

  const workspaceId = $derived(store.activeWorkspaceId);
  const workspacePath = $derived(store.activeWorkspace?.path ?? '/');

  const actions = $derived(
    qaStore.actions.filter(a => a.workspaceId === workspaceId)
  );

  const editingAction = $derived(
    editingId ? actions.find(a => a.id === editingId) ?? null : null
  );

  onMount(async () => {
    if (workspaceId) await qaStore.loadForWorkspace(workspaceId);
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

  async function handleAdd(label: string, command: string, args: string[], cwd: string | null) {
    if (!workspaceId) return;
    await qaStore.create(workspaceId, label, command, args, cwd);
    showForm = false;
  }

  async function handleUpdate(label: string, command: string, args: string[], cwd: string | null) {
    if (!editingId) return;
    await qaStore.update(editingId, label, command, args, cwd);
    editingId = null;
  }
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
  <!-- Header -->
  <div class="flex h-8 shrink-0 items-center justify-between border-b border-border bg-muted/40 px-3">
    <span class="text-xs font-semibold text-foreground">Quick Actions</span>
    <button
      onclick={() => { showForm = !showForm; editingId = null; }}
      title="Ajouter une action"
      class="flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Plus class="h-3.5 w-3.5" />
    </button>
  </div>

  <!-- Liste des actions -->
  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#if actions.length === 0 && !showForm}
      <div class="flex h-full items-center justify-center">
        <div class="flex flex-col items-center gap-2 text-center">
          <span class="text-sm text-muted-foreground">Aucune action configurée.</span>
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
