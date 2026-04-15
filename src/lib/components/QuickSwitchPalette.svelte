<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { store } from '$lib/state.svelte';
  import { registerKeybindAction } from '$lib/keybinds.svelte';
  import { flatWidgets, getWidgetDisplayName } from '$lib/layout';
  import type { Widget } from '$lib/types';
  import { Search, Terminal, TextAlignStart, Globe, Zap, FolderOpen } from '@lucide/svelte';

  let open = $state(false);
  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | undefined>(undefined);
  let listEl = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    if (open && inputEl) inputEl.focus();
  });

  $effect(() => {
    if (!listEl) return;
    listEl.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  });

  const filteredWorkspaces = $derived(
    store.workspaces.filter(ws =>
      ws.name.toLowerCase().includes(query.toLowerCase())
    )
  );

  const allWidgets = $derived(
    store.workspaces.flatMap(ws => {
      const layout = ws.layoutId ? store.layouts[ws.layoutId] : null;
      if (!layout) return [];
      return flatWidgets(layout.root).map(w => ({ ...w, workspaceId: ws.id, workspaceName: ws.name }));
    })
  );

  const filteredWidgets = $derived(
    allWidgets
      .filter(w => getWidgetDisplayName(w, store.autoLabels).toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const aActive = a.workspaceId === store.activeWorkspaceId ? 0 : 1;
        const bActive = b.workspaceId === store.activeWorkspaceId ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return a.workspaceName.localeCompare(b.workspaceName);
      })
  );

  const allItems = $derived([
    ...filteredWorkspaces.map(ws => ({ kind: 'workspace' as const, id: ws.id, workspaceId: ws.id })),
    ...filteredWidgets.map(w => ({ kind: 'widget' as const, id: w.id, workspaceId: w.workspaceId, workspaceName: w.workspaceName })),
  ]);

  $effect(() => {
    query; // réinitialiser la sélection à chaque changement de filtre
    selectedIndex = 0;
  });

  function openPalette() {
    open = true;
    query = '';
    selectedIndex = 0;
  }

  function closePalette() {
    open = false;
  }

  function activate(index: number) {
    const item = allItems[index];
    if (!item) return;
    if (item.kind === 'workspace') {
      store.setActiveWorkspace(item.id);
    } else {
      store.setActiveWorkspace(item.workspaceId);
      store.setActivePanel(item.id);
    }
    if (page.url.pathname !== '/') goto('/');
    closePalette();
  }

  // Navigation interne (uniquement quand la palette est ouverte).
  function handleInPaletteKeys(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape')    { e.preventDefault(); closePalette(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, allItems.length - 1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); return; }
    if (e.key === 'Enter')     { e.preventDefault(); activate(selectedIndex); return; }
  }

  onMount(() => {
    window.addEventListener('keydown', handleInPaletteKeys, { capture: true });
    const offOpen = registerKeybindAction('quickSwitch', () => openPalette());
    return () => {
      window.removeEventListener('keydown', handleInPaletteKeys, { capture: true });
      offOpen();
    };
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Palette de navigation rapide"
    tabindex="-1"
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[20vh]"
    onmousedown={(e) => { if (e.target === e.currentTarget) closePalette(); }}
  >
    <div class="bg-popover text-popover-foreground flex w-full max-w-lg max-h-[60vh] flex-col overflow-hidden rounded-md border shadow-md">
      <!-- Champ de recherche -->
      <div class="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Search class="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          bind:this={inputEl}
          bind:value={query}
          placeholder="Rechercher workspaces et widgets…"
          class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <!-- Résultats -->
      <div bind:this={listEl} class="flex-1 overflow-y-auto py-1">
        {#if filteredWorkspaces.length > 0}
          <p class="px-3 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">Workspaces</p>
          {#each filteredWorkspaces as ws, i (ws.id)}
            <button
              data-idx={i}
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors
                     {selectedIndex === i ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}"
              onmouseenter={() => (selectedIndex = i)}
              onclick={() => activate(i)}
            >
              <FolderOpen class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span class="flex-1 truncate">{ws.name}</span>
              {#if store.activeWorkspaceId === ws.id}
                <span class="text-xs text-muted-foreground">actif</span>
              {/if}
            </button>
          {/each}
        {/if}

        {#if filteredWidgets.length > 0}
          <p class="px-3 pb-1 pt-1.5 text-xs font-medium text-muted-foreground
                     {filteredWorkspaces.length > 0 ? 'mt-1 border-t border-border' : ''}">
            Widgets
          </p>
          {#each filteredWidgets as widget, i (widget.id)}
            {@const idx = filteredWorkspaces.length + i}
            <button
              data-idx={idx}
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors
                     {selectedIndex === idx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}"
              onmouseenter={() => (selectedIndex = idx)}
              onclick={() => activate(idx)}
            >
              {#if widget.type === 'terminal'}
                <Terminal class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {:else if widget.type === 'code'}
                <TextAlignStart class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {:else if widget.type === 'browser'}
                <Globe class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {:else if widget.type === 'actions'}
                <Zap class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {/if}
              <span class="flex-1 truncate">{getWidgetDisplayName(widget, store.autoLabels)}</span>
              <span class="shrink-0 text-xs text-muted-foreground/60">{widget.workspaceName}</span>
              {#if store.activePanelId === widget.id}
                <span class="text-xs text-muted-foreground">actif</span>
              {/if}
            </button>
          {/each}
        {/if}

        {#if filteredWorkspaces.length === 0 && filteredWidgets.length === 0}
          <p class="px-3 py-4 text-center text-sm text-muted-foreground">Aucun résultat</p>
        {/if}
      </div>

      <!-- Aide clavier -->
      <div class="flex items-center gap-3 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span><kbd class="font-mono">↑↓</kbd> naviguer</span>
        <span><kbd class="font-mono">↵</kbd> ouvrir</span>
        <span><kbd class="font-mono">Échap</kbd> fermer</span>
      </div>
    </div>
  </div>
{/if}
