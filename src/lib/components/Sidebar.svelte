<script lang="ts">
  import { store } from '$lib/state.svelte';
  import { theme } from '$lib/theme.svelte';
  import { FolderOpen, Sun, Moon } from '@lucide/svelte';
  import WorkspaceCreator from './WorkspaceCreator.svelte';
  import SidebarWorkspaceItem from './SidebarWorkspaceItem.svelte';
</script>

<aside class="flex h-full w-60 flex-shrink-0 flex-col border-r border-border bg-card">
  <div class="flex items-center gap-2 border-b border-border px-4 py-3">
    <FolderOpen class="h-4 w-4 text-muted-foreground" />
    <span class="flex-1 text-sm font-semibold">Workspaces</span>
    <WorkspaceCreator />
  </div>

  <ul class="flex-1 overflow-y-auto py-1">
    {#each store.workspaces as workspace (workspace.id)}
      <SidebarWorkspaceItem {workspace} />
    {/each}

    {#if store.workspaces.length === 0}
      <li class="px-4 py-3 text-xs text-muted-foreground">Aucun workspace</li>
    {/if}
  </ul>

  <div class="border-t border-border px-3 py-2">
    <button
      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground
             hover:bg-accent hover:text-accent-foreground transition-colors"
      onclick={theme.toggle}
      title={theme.dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      {#if theme.dark}
        <Sun class="h-3.5 w-3.5" />
        <span>Mode clair</span>
      {:else}
        <Moon class="h-3.5 w-3.5" />
        <span>Mode sombre</span>
      {/if}
    </button>
  </div>
</aside>
