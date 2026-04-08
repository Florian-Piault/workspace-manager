<script lang="ts">
  import { store } from '$lib/state.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Popover from '$lib/components/ui/popover';
  import { Plus, FolderOpen } from '@lucide/svelte';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';

  let name = $state('');
  let path = $state('');
  let open = $state(false);
  let suggestedName = $derived(() => {
    if (!path) return '';
    const parts = path.split(/[/\\]/);
    const strippedPath = parts[parts.length - 1] || '';
    const noDashes = strippedPath.replace(/[-_]+/g, ' ');
    return noDashes.at(0)?.toUpperCase() + noDashes.slice(1) || '';
  });

  async function browsePath() {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected) {
      path = selected;
      name = suggestedName();
    }
  }

  async function handleCreate() {
    if (!name.trim() || !path) return;
    await store.addWorkspace(name.trim(), path);
    name = '';
    path = '';
    open = false;
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    <Button
      variant="ghost"
      size="icon"
      class="h-7 w-7 shrink-0"
      title="Nouveau workspace"
    >
      <Plus class="h-4 w-4" />
    </Button>
  </Popover.Trigger>
  <Popover.Content
    class="w-72 p-4"
    align="start"
    onkeypress={e => e.key === 'Enter' && handleCreate()}
  >
    <div class="flex flex-col gap-3">
      <p class="text-sm font-semibold">Nouveau workspace</p>
      <div class="flex flex-col gap-1.5">
        <span class="text-xs text-muted-foreground">Dossier</span>
        <button
          class="flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                 hover:bg-accent hover:text-accent-foreground transition-colors text-left"
          onclick={browsePath}
          type="button"
        >
          <FolderOpen class="h-4 w-4 shrink-0 text-muted-foreground" />
          {#if path}
            <span class="truncate text-foreground">{path}</span>
          {:else}
            <span class="text-muted-foreground">Parcourir…</span>
          {/if}
        </button>
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-muted-foreground" for="ws-name">Nom</label>
        <Input id="ws-name" bind:value={name} placeholder="Mon Projet" />
      </div>
      <Button
        disabled={!name.trim() || !path}
        onclick={handleCreate}
        class="w-full"
      >
        Créer
      </Button>
    </div>
  </Popover.Content>
</Popover.Root>
