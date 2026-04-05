<script lang="ts">
  import { store } from '$lib/state.svelte';
  import { FolderOpen } from '@lucide/svelte';
  import WorkspaceCreator from './WorkspaceCreator.svelte';
</script>

<aside class="flex h-full w-60 flex-shrink-0 flex-col border-r border-border bg-card">
  <div class="flex items-center gap-2 border-b border-border px-4 py-3">
    <FolderOpen class="h-4 w-4 text-muted-foreground" />
    <span class="flex-1 text-sm font-semibold">Workspaces</span>
    <WorkspaceCreator />
  </div>

  <ul class="flex-1 overflow-y-auto py-1">
    {#each store.workspaces as workspace (workspace.id)}
      <li>
        <button
          class="flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors
                 hover:bg-accent hover:text-accent-foreground
                 {store.activeWorkspaceId === workspace.id
                   ? 'bg-accent text-accent-foreground font-medium'
                   : 'text-muted-foreground'}"
          onclick={() => store.setActiveWorkspace(workspace.id)}
        >
          {workspace.name}
        </button>
      </li>
    {/each}

    {#if store.workspaces.length === 0}
      <li class="px-4 py-3 text-xs text-muted-foreground">Aucun workspace</li>
    {/if}
  </ul>
</aside>
