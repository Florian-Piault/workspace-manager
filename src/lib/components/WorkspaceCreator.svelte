<script lang="ts">
  import { store } from '$lib/state.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Popover from '$lib/components/ui/popover';
  import { Plus } from '@lucide/svelte';

  let name = $state('');
  let path = $state('');
  let open = $state(false);

  async function handleCreate() {
    if (!name.trim() || !path.trim()) return;
    await store.addWorkspace(name.trim(), path.trim());
    name = '';
    path = '';
    open = false;
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" title="Nouveau workspace">
      <Plus class="h-4 w-4" />
    </Button>
  </Popover.Trigger>
  <Popover.Content class="w-72 p-4" align="start">
    <div class="flex flex-col gap-3">
      <p class="text-sm font-semibold">Nouveau workspace</p>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-muted-foreground" for="ws-name">Nom</label>
        <Input id="ws-name" bind:value={name} placeholder="Mon Projet" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-xs text-muted-foreground" for="ws-path">Chemin</label>
        <Input id="ws-path" bind:value={path} placeholder="/Users/me/mon-projet" />
      </div>
      <Button
        disabled={!name.trim() || !path.trim()}
        onclick={handleCreate}
        class="w-full"
      >
        Créer
      </Button>
    </div>
  </Popover.Content>
</Popover.Root>
