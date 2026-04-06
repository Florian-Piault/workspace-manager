<script lang="ts">
  import { store } from '$lib/state.svelte';
  import { FolderOpen } from '@lucide/svelte';
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
</aside>
