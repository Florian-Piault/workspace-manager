<script lang="ts">
  import {
    ChevronRight,
    ChevronDown,
    X,
    Check,
    Terminal,
    TextAlignStart,
    Globe,
    Zap
  } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { store } from '$lib/state.svelte';
  import { settings } from '$lib/settings.svelte';
  import { flatWidgets } from '$lib/layout';
  import type { Workspace } from '$lib/types';

  function goHome() {
    if ($page.url.pathname !== '/') goto('/');
  }

  let { workspace }: { workspace: Workspace } = $props();

  let collapsed = $state(false);
  let renamingWorkspace = $state(false);
  let workspaceDraft = $state('');
  let confirmingClose = $state(false);

  const layout = $derived(
    workspace.layoutId ? (store.layouts[workspace.layoutId] ?? null) : null
  );
  const widgets = $derived(layout ? flatWidgets(layout.root) : []);

  function startRenameWorkspace() {
    workspaceDraft = workspace.name;
    renamingWorkspace = true;
  }

  function confirmRenameWorkspace() {
    renamingWorkspace = false;
    const trimmed = workspaceDraft.trim();
    if (trimmed && trimmed !== workspace.name) {
      store.renameWorkspace(workspace.id, trimmed);
    }
  }

  function handleWorkspaceKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmRenameWorkspace();
    if (e.key === 'Escape') renamingWorkspace = false;
  }

  function handleCloseWorkspace() {
    if (settings.general.confirmCloseWorkspace) {
      confirmingClose = true;
    } else {
      store.closeWorkspace(workspace.id);
    }
  }
</script>

<li>
  <!-- Workspace header -->
  <div
    class="flex items-center gap-1 px-2 py-1.5 group/ws hover:bg-accent/50
             {store.activeWorkspaceId === workspace.id
      ? 'border-l-2 border-primary pl-1.5'
      : 'border-l-2 border-transparent pl-1.5'}"
  >
    <button
      class="p-0.5 text-muted-foreground hover:text-foreground"
      onclick={() => (collapsed = !collapsed)}
      aria-label={collapsed ? 'Développer' : 'Réduire'}
    >
      {#if collapsed}
        <ChevronRight class="h-3.5 w-3.5" />
      {:else}
        <ChevronDown class="h-3.5 w-3.5" />
      {/if}
    </button>

    {#if renamingWorkspace}
      <input
        class="flex-1 bg-transparent text-sm text-foreground outline-none"
        bind:value={workspaceDraft}
        onblur={confirmRenameWorkspace}
        onkeydown={handleWorkspaceKeydown}
      />
    {:else}
      <button
        class="flex-1 truncate text-left text-sm font-medium
               {store.activeWorkspaceId === workspace.id
          ? 'text-foreground'
          : 'text-muted-foreground'}
               hover:text-foreground"
        onclick={() => {
          store.setActiveWorkspace(workspace.id);
          goHome();
        }}
        ondblclick={startRenameWorkspace}
        title="Cliquer pour activer, double-cliquer pour renommer"
      >
        {workspace.name}
      </button>
    {/if}

    {#if confirmingClose}
      <div class="flex items-center gap-0.5">
        <button
          class="p-0.5 text-muted-foreground hover:text-foreground"
          onclick={() => (confirmingClose = false)}
          title="Annuler"
        >
          <X class="h-3 w-3" />
        </button>
        <button
          class="p-0.5 text-destructive hover:text-destructive/70"
          onclick={() => {
            confirmingClose = false;
            store.closeWorkspace(workspace.id);
          }}
          title="Confirmer"
        >
          <Check class="h-3 w-3" />
        </button>
      </div>
    {:else}
      <button
        class="hidden group-hover/ws:flex p-0.5 text-muted-foreground hover:text-destructive"
        onclick={handleCloseWorkspace}
        title="Fermer le workspace"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    {/if}
  </div>

  <!-- Widget list -->
  {#if !collapsed}
    <ul class="pb-1">
      {#each widgets as widget (widget.id)}
        <li
          class="group/widget flex items-center gap-1.5 px-6 py-1 {store.activePanelId ===
          widget.id
            ? 'bg-accent/40'
            : 'hover:bg-accent/30'}"
        >
          <button
            class="flex flex-1 min-w-0 items-center gap-1.5 text-left"
            onclick={() => {
              store.setActiveWorkspace(workspace.id);
              store.setActivePanel(widget.id);
              goHome();
            }}
          >
            <span class="relative shrink-0">
              {#if widget.type === 'terminal'}
                <Terminal
                  class="h-3 w-3 {store.activePanelId === widget.id
                    ? 'text-foreground'
                    : 'text-muted-foreground'}"
                />
              {:else if widget.type === 'code'}
                <TextAlignStart
                  class="h-3 w-3 {store.activePanelId === widget.id
                    ? 'text-foreground'
                    : 'text-muted-foreground'}"
                />
              {:else if widget.type === 'browser'}
                <Globe
                  class="h-3 w-3 {store.activePanelId === widget.id
                    ? 'text-foreground'
                    : 'text-muted-foreground'}"
                />
              {:else if widget.type === 'actions'}
                <Zap
                  class="h-3 w-3 {store.activePanelId === widget.id
                    ? 'text-foreground'
                    : 'text-muted-foreground'}"
                />
              {/if}
              {#if store.savingWidgets.has(widget.id)}
                <span
                  class="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                ></span>
              {/if}
            </span>
            {#if store.dirtyWidgets.has(widget.id)}
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
              ></span>
            {/if}
            <span
              class="flex-1 truncate text-xs {store.activePanelId === widget.id
                ? 'text-foreground'
                : 'text-muted-foreground'}"
            >
              {widget.label ?? store.autoLabels.get(widget.id) ?? widget.type}
            </span>
          </button>
          <button
            class="hidden group-hover/widget:flex p-0.5 text-muted-foreground hover:text-destructive"
            onclick={() => store.closePanelInWorkspace(workspace.id, widget.id)}
            title="Fermer le widget"
          >
            <X class="h-3 w-3" />
          </button>
        </li>
      {/each}

      {#if widgets.length === 0}
        <li class="px-6 py-1 text-xs text-muted-foreground/50">Aucun widget</li>
      {/if}
    </ul>
  {/if}
</li>
