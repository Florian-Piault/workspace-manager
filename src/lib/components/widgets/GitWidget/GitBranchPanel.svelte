<script lang="ts">
  import { ChevronRight, ChevronDown, Plus, X } from '@lucide/svelte';
  import type { BranchInfo } from './types';

  let {
    branches,
    onCheckout,
    onCreateBranch,
    onDeleteBranch,
    onDeleteRemoteBranch
  }: {
    branches: BranchInfo[];
    onCheckout: (name: string) => Promise<void>;
    onCreateBranch: (name: string) => Promise<void>;
    onDeleteBranch: (name: string) => Promise<void>;
    onDeleteRemoteBranch: (remote: string, branch: string) => Promise<void>;
  } = $props();

  let expanded = $state(true);
  let newBranchName = $state('');
  let showNewInput = $state(false);
  let confirmDelete = $state<string | null>(null);

  const local = $derived(branches.filter(b => !b.is_remote));
  const remote = $derived(branches.filter(b => b.is_remote));

  async function handleCreate() {
    const name = newBranchName.trim();
    if (!name) return;
    await onCreateBranch(name);
    newBranchName = '';
    showNewInput = false;
  }

  function onNewKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') { showNewInput = false; newBranchName = ''; }
  }

  async function handleDelete(name: string) {
    await onDeleteBranch(name);
    confirmDelete = null;
  }

  async function handleDeleteRemote(fullName: string) {
    // fullName = "origin/feature-xyz" → remote="origin", branch="feature-xyz"
    const slash = fullName.indexOf('/');
    if (slash === -1) return;
    const remote = fullName.slice(0, slash);
    const branch = fullName.slice(slash + 1);
    await onDeleteRemoteBranch(remote, branch);
    confirmDelete = null;
  }
</script>

<div class="shrink-0 border-t border-border">
  <!-- Section header -->
  <div class="flex items-center px-2 py-1.5">
    <button
      onclick={() => (expanded = !expanded)}
      class="flex flex-1 items-center gap-1 text-[10px] font-semibold
             tracking-widest uppercase text-muted-foreground/60
             hover:text-muted-foreground transition-colors"
    >
      {#if expanded}
        <ChevronDown class="h-3 w-3" />
      {:else}
        <ChevronRight class="h-3 w-3" />
      {/if}
      Branches
    </button>
    <button
      onclick={() => { showNewInput = !showNewInput; }}
      aria-label="Nouvelle branche"
      class="ml-auto rounded p-0.5 text-muted-foreground/50
             hover:text-foreground hover:bg-muted transition-colors"
    >
      <Plus class="h-3 w-3" />
    </button>
  </div>

  {#if expanded}
    <div class="flex flex-col pb-1">
      <!-- New branch input -->
      {#if showNewInput}
        <div class="px-2 pb-1">
          <input
            bind:value={newBranchName}
            onkeydown={onNewKeydown}
            placeholder="nom-de-branche"
            autofocus
            aria-label="Nom de la nouvelle branche"
            class="w-full rounded-sm border border-border bg-background px-2 py-0.5
                   font-mono text-xs text-foreground placeholder:text-muted-foreground/40
                   focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      {/if}

      <!-- Local branches -->
      {#each local as branch (branch.name)}
        <div class="group flex items-center gap-1.5 px-2 py-0.5">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full {branch.is_current ? 'bg-primary' : 'bg-transparent'}"></span>
          <span
            class="min-w-0 flex-1 truncate font-mono text-xs
                   {branch.is_current ? 'font-medium text-foreground' : 'text-muted-foreground'}"
          >
            {branch.name}
          </span>

          {#if confirmDelete === branch.name}
            <button
              onclick={() => handleDelete(branch.name)}
              class="text-[10px] text-destructive hover:underline"
            >Suppr ?</button>
            <button
              onclick={() => (confirmDelete = null)}
              class="text-[10px] text-muted-foreground hover:underline"
            >Annuler</button>
          {:else if !branch.is_current}
            <button
              onclick={() => onCheckout(branch.name)}
              aria-label="Checkout {branch.name}"
              class="shrink-0 text-[10px] text-muted-foreground opacity-0
                     group-hover:opacity-100 hover:text-foreground transition-all"
            >checkout</button>
            <button
              onclick={() => (confirmDelete = branch.name)}
              aria-label="Supprimer {branch.name}"
              class="shrink-0 opacity-0 group-hover:opacity-100
                     text-muted-foreground hover:text-destructive transition-all"
            >
              <X class="h-3 w-3" />
            </button>
          {/if}
        </div>
      {/each}

      <!-- Remote branches -->
      {#if remote.length > 0}
        <div class="mt-1 px-2 pb-0.5 text-[10px] tracking-widest uppercase text-muted-foreground/40">
          Remote
        </div>
        {#each remote as branch (branch.name)}
          <div class="group flex items-center gap-1.5 px-2 py-0.5">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-transparent"></span>
            <span class="min-w-0 flex-1 truncate font-mono text-xs italic text-muted-foreground/50">
              {branch.name}
            </span>

            {#if confirmDelete === branch.name}
              <button
                onclick={() => handleDeleteRemote(branch.name)}
                class="text-[10px] text-destructive hover:underline"
              >Suppr ?</button>
              <button
                onclick={() => (confirmDelete = null)}
                class="text-[10px] text-muted-foreground hover:underline"
              >Annuler</button>
            {:else}
              <button
                onclick={() => (confirmDelete = branch.name)}
                aria-label="Supprimer {branch.name}"
                class="shrink-0 opacity-0 group-hover:opacity-100
                       text-muted-foreground hover:text-destructive transition-all"
              >
                <X class="h-3 w-3" />
              </button>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
