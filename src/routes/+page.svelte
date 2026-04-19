<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '$lib/state.svelte';
  import { settings } from '$lib/settings.svelte';
  import { registerKeybindAction } from '$lib/keybinds.svelte';
  import { flatWidgets } from '$lib/layout';
  import LayoutEngine from '$lib/components/LayoutEngine.svelte';
  import PanelOverlay from '$lib/components/PanelOverlay.svelte';
  import CodeEditorWidget from '$lib/components/widgets/CodeEditor/CodeEditorWidget.svelte';
  import TerminalWidget from '$lib/components/widgets/TerminalWidget/TerminalWidget.svelte';
  import BrowserWidget from '$lib/components/widgets/BrowserWidget/BrowserWidget.svelte';

  let storeReady = $state(false);

  // Persiste le dernier workspace actif
  $effect(() => {
    if (store.activeWorkspaceId) {
      try { localStorage.setItem('last-workspace-id', store.activeWorkspaceId); } catch {}
    }
  });

  // Rouvre le dernier workspace au démarrage si le setting est activé
  let hasRestored = false;
  $effect(() => {
    if (!storeReady || !settings.ready || hasRestored) return;
    hasRestored = true;
    if (settings.general.reopenLastWorkspace) {
      const lastId = localStorage.getItem('last-workspace-id');
      if (lastId && store.workspaces.find(w => w.id === lastId)) {
        store.setActiveWorkspace(lastId);
      }
    }
  });

  const maximizedWidget = $derived(
    store.maximizedPanelId && store.activeLayout
      ? (flatWidgets(store.activeLayout.root).find((w) => w.id === store.maximizedPanelId) ?? null)
      : null
  );

  onMount(() => {
    store.init()
      .then(() => { storeReady = true; })
      .catch((err) => { console.error('[WorkspaceStore] init failed:', err); storeReady = true; });

    const offs = [
      registerKeybindAction('splitHorizontal', () => {
        if (store.activePanelId) store.splitPanel(store.activePanelId, 'horizontal');
      }),
      registerKeybindAction('splitVertical', () => {
        if (store.activePanelId) store.splitPanel(store.activePanelId, 'vertical');
      }),
      registerKeybindAction('closePanel', () => {
        if (store.activePanelId) store.closePanel(store.activePanelId);
      }),
    ];
    return () => offs.forEach(off => off());
  });
</script>

{#if store.activeLayout}
  <LayoutEngine node={store.activeLayout.root} isRoot={true} />
{:else}
  <div class="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground select-none">
    <div class="flex flex-col items-center gap-2">
      <p class="text-sm font-medium text-foreground">Aucun workspace actif</p>
      <p class="text-xs">Sélectionne un workspace dans la barre latérale</p>
      <p class="text-xs">ou crée-en un avec le bouton <kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">+</kbd></p>
    </div>
  </div>
{/if}

<!-- Overlay maximize -->
{#if maximizedWidget}
  <div class="absolute inset-0 z-40 bg-background">
    <PanelOverlay nodeId={maximizedWidget.id} widget={maximizedWidget} isRoot={true}>
      {#snippet children(pillControls)}
        {#if maximizedWidget.type === 'code'}
          <CodeEditorWidget config={maximizedWidget.config} nodeId={maximizedWidget.id} {pillControls} />
        {:else if maximizedWidget.type === 'terminal'}
          <TerminalWidget config={maximizedWidget.config} nodeId={maximizedWidget.id} {pillControls} />
        {:else if maximizedWidget.type === 'browser'}
          <BrowserWidget config={maximizedWidget.config} nodeId={maximizedWidget.id} {pillControls} />
        {/if}
      {/snippet}
    </PanelOverlay>
  </div>
{/if}
