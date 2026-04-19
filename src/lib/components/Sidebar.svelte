<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { store } from '$lib/state.svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import {
    FolderOpen,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
    X,
    Minus,
    Maximize2,
    Square,
    Folder,
    Settings,
    ArrowLeft,
    Plus
  } from '@lucide/svelte';
  import WorkspaceCreator from './WorkspaceCreator.svelte';
  import SidebarWorkspaceItem from './SidebarWorkspaceItem.svelte';
  import type { Workspace } from '$lib/types';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import { settings } from '$lib/settings.svelte';
  import { registerKeybindAction } from '$lib/keybinds.svelte';

  const appWindow = getCurrentWindow();
  const isMac =
    typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
  const isWindows =
    typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);

  let isFullscreen = $state(false);

  function startWindowDrag(e: MouseEvent) {
    if (e.button === 0) appWindow.startDragging().catch(() => {});
  }

  function closeWindow() {
    appWindow.close();
  }
  function minimizeWindow() {
    appWindow.minimize();
  }
  async function maximizeWindow() {
    if (isMac) {
      isFullscreen = !isFullscreen;
      await appWindow.setFullscreen(isFullscreen);
    } else {
      await appWindow.toggleMaximize();
    }
  }

  const STORAGE_KEY = 'sidebar-collapsed';

  let collapsed = $state(false);
  let dndItems = $state<Workspace[]>([]);

  // Sync dndItems from store (hors drag)
  $effect(() => {
    dndItems = [...store.workspaces];
  });

  function toggle() {
    collapsed = !collapsed;
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
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
    } catch {
      /* ignore */
    }

    // Toggle sidebar shortcut (configurable)
    return registerKeybindAction('toggleSidebar', () => toggle());
  });
</script>

<aside
  class="flex h-full shrink-0 flex-col bg-card transition-[width] duration-200 ease-in-out overflow-hidden
         {settings.general.sidebarPosition === 'right'
    ? 'border-l'
    : 'border-r'} border-border
         {collapsed ? 'w-12' : 'w-60'}"
>
  <!-- Contrôles de fenêtre -->
  {#if isMac}
    <!-- macOS : traffic lights -->
    <div
      class="group/wc flex border-b border-border
                {collapsed
        ? 'flex-col items-center gap-1 px-0 py-2.5'
        : 'flex-row items-center gap-1.5 px-3 py-2.5'}"
    >
      <button
        class="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#FF5F57] transition-opacity hover:opacity-80 active:opacity-60"
        onclick={closeWindow}
        title="Fermer"
        aria-label="Fermer la fenêtre"
      >
        <X
          class="h-1.5 w-1.5 text-black/60 opacity-0 transition-opacity group-hover/wc:opacity-100"
        />
      </button>
      <button
        class="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#FFBD2E] transition-opacity hover:opacity-80 active:opacity-60"
        onclick={minimizeWindow}
        title="Réduire"
        aria-label="Réduire la fenêtre"
      >
        <Minus
          class="h-1.5 w-1.5 text-black/60 opacity-0 transition-opacity group-hover/wc:opacity-100"
        />
      </button>
      <button
        class="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#28C840] transition-opacity hover:opacity-80 active:opacity-60"
        onclick={maximizeWindow}
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        aria-label="Plein écran"
      >
        <Plus
          class="h-1.5 w-1.5 text-black/60 opacity-0 transition-opacity group-hover/wc:opacity-100"
        />
      </button>
      {#if !collapsed}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="flex-1 cursor-move self-stretch"
          onmousedown={startWindowDrag}
        ></div>
      {/if}
    </div>
  {:else if isWindows}
    <!-- Windows 11 : boutons rectangulaires -->
    <div
      class="flex border-b border-border
                {collapsed
        ? 'flex-col-reverse items-center gap-0.5 px-1 py-1.5'
        : 'flex-row items-center px-1 py-1'}"
    >
      <button
        class="flex h-7 items-center justify-center rounded text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground active:bg-accent/80
               {collapsed ? 'w-10' : 'w-11'}"
        onclick={minimizeWindow}
        title="Réduire"
        aria-label="Réduire la fenêtre"
      >
        <Minus class="h-3.5 w-3.5" />
      </button>
      <button
        class="flex h-7 items-center justify-center rounded text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground active:bg-accent/80
               {collapsed ? 'w-10' : 'w-11'}"
        onclick={maximizeWindow}
        title="Agrandir"
        aria-label="Agrandir la fenêtre"
      >
        <Square class="h-3.5 w-3.5" />
      </button>

      <button
        class="flex h-7 items-center justify-center rounded text-foreground/70 transition-colors hover:bg-[#C42B1C] hover:text-white active:bg-[#C42B1C]/80
               {collapsed ? 'w-10' : 'w-11'}"
        onclick={closeWindow}
        title="Fermer"
        aria-label="Fermer la fenêtre"
      >
        <X class="h-3.5 w-3.5" />
      </button>
      {#if !collapsed}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="flex-1 cursor-move self-stretch"
          onmousedown={startWindowDrag}
        ></div>
      {/if}
    </div>
  {:else}
    <!-- Linux / générique -->
    <div
      class="group/wc flex border-b border-border
                {collapsed
        ? 'flex-col items-center gap-1 px-0 py-2.5'
        : 'flex-row items-center gap-1.5 px-3 py-2.5'}"
    >
      <button
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        onclick={closeWindow}
        title="Fermer"
        aria-label="Fermer la fenêtre"><X class="h-3 w-3" /></button
      >
      <button
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        onclick={minimizeWindow}
        title="Réduire"
        aria-label="Réduire la fenêtre"><Minus class="h-3 w-3" /></button
      >
      <button
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        onclick={maximizeWindow}
        title="Agrandir"
        aria-label="Agrandir la fenêtre"><Maximize2 class="h-3 w-3" /></button
      >
      {#if !collapsed}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="flex-1 cursor-move self-stretch"
          onmousedown={startWindowDrag}
        ></div>
      {/if}
    </div>
  {/if}

  <!-- Header -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex items-center gap-2 border-b border-border px-2 py-3 {collapsed
      ? 'justify-center cursor-move'
      : 'px-4'}"
    onmousedown={collapsed ? startWindowDrag : undefined}
  >
    {#if !collapsed}
      <FolderOpen class="h-4 w-4 shrink-0 text-muted-foreground" />
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="flex-1 cursor-move select-none text-sm font-semibold"
        onmousedown={startWindowDrag}>Workspaces</span
      >
      <WorkspaceCreator />
    {/if}
    <button
      class="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors
             {settings.general.sidebarPosition === 'right' && !collapsed
        ? 'order-first'
        : ''}"
      onclick={toggle}
      onmousedown={e => e.stopPropagation()}
      title={collapsed
        ? 'Développer la sidebar (⌘B)'
        : 'Réduire la sidebar (⌘B)'}
    >
      {#if settings.general.sidebarPosition === 'right'}
        {#if collapsed}
          <PanelRightOpen class="h-4 w-4" />
        {:else}
          <PanelRightClose class="h-4 w-4" />
        {/if}
      {:else if collapsed}
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
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger>
              <li>
                <button
                  class="relative flex items-center justify-center rounded p-2 transition-colors
                   {store.activeWorkspaceId === workspace.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
                  onclick={() => {
                    store.setActiveWorkspace(workspace.id);
                    if ($page.url.pathname !== '/') goto('/');
                  }}
                  title={workspace.name}
                >
                  {#if store.activeWorkspaceId === workspace.id}
                    <FolderOpen class="h-4 w-4" />
                  {:else}
                    <Folder class="h-4 w-4" />
                  {/if}
                  {#if store.activeWorkspaceId === workspace.id && store.dirtyWidgets.size > 0}
                    <span
                      class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"
                    ></span>
                  {/if}
                </button>
              </li>
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>{workspace.name}</p>
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
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

  <!-- Footer : paramètres / retour -->
  <div
    class="border-t border-border {collapsed
      ? 'flex justify-center px-2 py-2'
      : 'px-3 py-2'}"
  >
    {#if $page.url.pathname === '/settings'}
      <button
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground
               hover:bg-accent hover:text-accent-foreground transition-colors
               {collapsed ? 'w-auto' : 'w-full'}"
        onclick={() => goto('/')}
        title="Retour"
      >
        <ArrowLeft class="h-3.5 w-3.5 shrink-0" />
        {#if !collapsed}<span>Retour</span>{/if}
      </button>
    {:else}
      <button
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground
               hover:bg-accent hover:text-accent-foreground transition-colors
               {collapsed ? 'w-auto' : 'w-full'}"
        onclick={() => goto('/settings')}
        title="Paramètres"
      >
        <Settings class="h-3.5 w-3.5 shrink-0" />
        {#if !collapsed}<span>Paramètres</span>{/if}
      </button>
    {/if}
  </div>
</aside>
