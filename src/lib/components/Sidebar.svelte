<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '$lib/state.svelte';
  import { theme } from '$lib/theme.svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { FolderOpen, Sun, Moon, PanelLeftClose, PanelLeftOpen } from '@lucide/svelte';
  import WorkspaceCreator from './WorkspaceCreator.svelte';
  import SidebarWorkspaceItem from './SidebarWorkspaceItem.svelte';
  import type { Workspace } from '$lib/types';

  const STORAGE_KEY = 'sidebar-collapsed';

  let collapsed = $state(false);
  let dndItems = $state<Workspace[]>([]);

  // Sync dndItems from store (hors drag)
  $effect(() => {
    dndItems = [...store.workspaces];
  });

  function toggle() {
    collapsed = !collapsed;
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch { /* ignore */ }
  }

  function handleConsider(e: CustomEvent<DndEvent<Workspace>>) {
    dndItems = e.detail.items;
  }

  function handleFinalize(e: CustomEvent<DndEvent<Workspace>>) {
    dndItems = e.detail.items;
    store.reorderWorkspaces(e.detail.items);
  }

  onMount(() => {
    // Restore collapsed state
    try {
      collapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    } catch { /* ignore */ }

    // ⌘+B / Ctrl+B shortcut
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', handleKeydown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeydown, { capture: true });
  });
</script>

<aside
  class="flex h-full flex-shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out overflow-hidden
         {collapsed ? 'w-12' : 'w-60'}"
>
  <!-- Header -->
  <div class="flex items-center gap-2 border-b border-border px-2 py-3 {collapsed ? 'justify-center' : 'px-4'}">
    {#if !collapsed}
      <FolderOpen class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span class="flex-1 text-sm font-semibold">Workspaces</span>
      <WorkspaceCreator />
    {/if}
    <button
      class="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      onclick={toggle}
      title={collapsed ? 'Développer la sidebar (⌘B)' : 'Réduire la sidebar (⌘B)'}
    >
      {#if collapsed}
        <PanelLeftOpen class="h-4 w-4" />
      {:else}
        <PanelLeftClose class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <!-- Workspace list -->
  {#if collapsed}
    <!-- Mode icônes -->
    <ul class="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
      {#each store.workspaces as workspace (workspace.id)}
        <li>
          <button
            class="flex items-center justify-center rounded p-2 transition-colors
                   {store.activeWorkspaceId === workspace.id
                     ? 'bg-accent text-foreground'
                     : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
            onclick={() => store.setActiveWorkspace(workspace.id)}
            title={workspace.name}
          >
            <FolderOpen class="h-4 w-4" />
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <!-- Mode complet avec DnD -->
    <ul
      class="flex-1 overflow-y-auto py-1"
      use:dndzone={{ items: dndItems, type: 'workspace', flipDurationMs: 150 }}
      onconsider={handleConsider}
      onfinalize={handleFinalize}
    >
      {#each dndItems as workspace (workspace.id)}
        <SidebarWorkspaceItem {workspace} />
      {/each}

      {#if dndItems.length === 0}
        <li class="px-4 py-3 text-xs text-muted-foreground">Aucun workspace</li>
      {/if}
    </ul>
  {/if}

  <!-- Footer : toggle dark mode -->
  <div class="border-t border-border {collapsed ? 'flex justify-center px-2 py-2' : 'px-3 py-2'}">
    <button
      class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground
             hover:bg-accent hover:text-accent-foreground transition-colors
             {collapsed ? 'w-auto' : 'w-full'}"
      onclick={theme.toggle}
      title={theme.dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      {#if theme.dark}
        <Sun class="h-3.5 w-3.5 flex-shrink-0" />
        {#if !collapsed}<span>Mode clair</span>{/if}
      {:else}
        <Moon class="h-3.5 w-3.5 flex-shrink-0" />
        {#if !collapsed}<span>Mode sombre</span>{/if}
      {/if}
    </button>
  </div>
</aside>
