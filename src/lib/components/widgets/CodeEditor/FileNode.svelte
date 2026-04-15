<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import FileNode from './FileNode.svelte';
  import {
    ChevronRight,
    ChevronDown,
    Folder,
    FolderOpen,
    FileText,
    FileCode,
    File,
    FilePlus,
    FolderPlus,
    Pencil,
    Trash2
  } from '@lucide/svelte';
  import type { FileEntry } from './types';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import { getFileTreeContext, FILE_ICON_EXTENSIONS } from './file-tree-context';

  let {
    entry,
    depth = 0
  }: {
    entry: FileEntry;
    depth?: number;
  } = $props();

  const ctx = getFileTreeContext();

  // Per-node reactive state
  let children = $state<FileEntry[]>([]);
  let loading = $state(false);
  let isRenaming = $state(false);
  let renameValue = $state('');
  let isFocused = $state(false);

  // Fine-grained: only invalidates when THIS path's membership changes in the SvelteSet.
  const isOpen = $derived(ctx.expanded.has(entry.path));
  const isActive = $derived(!entry.is_dir && ctx.activeFilePath === entry.path);
  // Only the node that is the pendingCreate parent re-evaluates its rendering of the inline input.
  const pendingHere = $derived(
    ctx.pendingCreate !== null && ctx.pendingCreate.parentPath === entry.path
  );
  const paddingLeft = $derived(`${depth * 12 + 8}px`);

  // Stable derivations
  const FileIcon = $derived(getFileIcon(entry.name));
  const parentPath = $derived(getParentPath(entry.path));
  const contextMenuParent = $derived(entry.is_dir ? entry.path : parentPath);

  function getParentPath(path: string): string {
    const idx = path.lastIndexOf('/');
    return idx >= 0 ? path.slice(0, idx) : '';
  }

  function getFileIcon(name: string) {
    const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
    if (FILE_ICON_EXTENSIONS.code.has(ext)) return FileCode;
    if (FILE_ICON_EXTENSIONS.text.has(ext)) return FileText;
    return File;
  }

  async function loadChildren() {
    loading = true;
    try {
      children = await invoke<FileEntry[]>('get_directory_contents', {
        path: entry.path,
        workspaceRoot: ctx.workspaceRoot,
        showHiddenFiles: ctx.showHiddenFiles,
        excludePatterns: ctx.excludePatterns
      });
    } catch (err) {
      console.error('[FileNode] get_directory_contents failed:', err);
    } finally {
      loading = false;
    }
  }

  async function handleClick() {
    if (entry.is_dir) {
      if (!isOpen && children.length === 0) {
        await loadChildren();
      }
      ctx.onToggleFolder(entry.path, !isOpen);
    } else {
      ctx.onFileClick(entry.path);
    }
  }

  // Lazy-load children on first expand.
  $effect(() => {
    if (isOpen && children.length === 0) {
      loadChildren();
    }
  });

  // Per-path refresh: only this directory's effect re-runs thanks to SvelteMap fine-grained tracking.
  $effect(() => {
    if (!entry.is_dir) return;
    const key = ctx.refreshKeys.get(entry.path);
    if (key !== undefined && key > 0) {
      children = [];
    }
  });

  function handleNodeKeydown(e: KeyboardEvent) {
    if (isRenaming) return;
    const isDelete = e.key === 'Delete' || (e.metaKey && e.key === 'Backspace');
    if (isDelete) {
      e.preventDefault();
      ctx.onDelete(entry.path, entry.is_dir);
    }
  }

  function startRename() {
    renameValue = entry.name;
    isRenaming = true;
  }

  function confirmRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== entry.name) {
      ctx.onRename(entry.path, trimmed);
    }
    isRenaming = false;
  }

  function cancelRename() {
    isRenaming = false;
  }
</script>

<div>
  <ContextMenu.Root>
    <ContextMenu.Trigger>
      <button
        class="flex w-full items-center gap-1.5 rounded py-0.5 pr-2 text-sm transition-colors
               {isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
        style="padding-left: {paddingLeft}"
        onclick={handleClick}
        onfocus={() => {
          isFocused = true;
        }}
        onblur={() => {
          isFocused = false;
        }}
        onkeydown={handleNodeKeydown}
      >
        {#if entry.is_dir}
          <span class="shrink-0 text-muted-foreground">
            {#if isOpen}
              <ChevronDown class="h-3.5 w-3.5" />
            {:else}
              <ChevronRight class="h-3.5 w-3.5" />
            {/if}
          </span>
          <span class="shrink-0 text-blue-400/80">
            {#if isOpen}
              <FolderOpen class="h-3.5 w-3.5" />
            {:else}
              <Folder class="h-3.5 w-3.5" />
            {/if}
          </span>
        {:else}
          <span class="w-3.5 shrink-0"></span>
          <span class="shrink-0 text-muted-foreground/70">
            <FileIcon class="h-3.5 w-3.5" />
          </span>
        {/if}
        {#if isRenaming}
          <input
            class="bg-transparent border-b border-primary outline-none text-sm w-full"
            bind:value={renameValue}
            autofocus
            onblur={cancelRename}
            onkeydown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelRename();
              }
            }}
            onclick={e => e.stopPropagation()}
          />
        {:else}
          <span class="truncate">{entry.name}</span>
        {/if}
        {#if loading}
          <span
            class="ml-auto shrink-0 h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent"
          ></span>
        {/if}
      </button>
    </ContextMenu.Trigger>
    <ContextMenu.Content>
      <ContextMenu.Item
        onclick={() => ctx.onCreateFile(contextMenuParent)}
        class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-accent"
      >
        <FilePlus class="h-3.5 w-3.5" />
        Nouveau fichier
      </ContextMenu.Item>
      <ContextMenu.Item
        onclick={() => ctx.onCreateDirectory(contextMenuParent)}
        class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-accent"
      >
        <FolderPlus class="h-3.5 w-3.5" />
        Nouveau dossier
      </ContextMenu.Item>
      <ContextMenu.Separator class="my-1 border-t border-border" />
      <ContextMenu.Item
        onclick={startRename}
        class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-accent"
      >
        <Pencil class="h-3.5 w-3.5" />
        Renommer
      </ContextMenu.Item>
      <ContextMenu.Item
        onclick={() => ctx.onDelete(entry.path, entry.is_dir)}
        class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-accent hover:text-primary-foreground text-destructive"
      >
        <Trash2 class="h-3.5 w-3.5" />
        Supprimer
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>

  {#if isOpen}
    {#if pendingHere && ctx.pendingCreate}
      {@const pending = ctx.pendingCreate}
      <div
        class="flex items-center gap-1.5 py-0.5 pr-2"
        style="padding-left: {(depth + 1) * 12 + 8}px"
      >
        {#if pending.type === 'file'}
          <span class="w-3.5 shrink-0"></span>
          <File class="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        {:else}
          <span class="w-3.5 shrink-0"></span>
          <Folder class="h-3.5 w-3.5 shrink-0 text-blue-400/80" />
        {/if}
        <input
          autofocus
          class="bg-transparent border-b border-primary outline-none text-sm flex-1 min-w-0"
          placeholder={pending.type === 'file'
            ? 'nouveau-fichier.ts'
            : 'nouveau-dossier'}
          onblur={e => {
            if (!(e.currentTarget as HTMLInputElement).value.trim()) {
              ctx.onCancelCreate();
            }
          }}
          onkeydown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              ctx.onConfirmCreate(
                (e.currentTarget as HTMLInputElement).value.trim()
              );
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              ctx.onCancelCreate();
            }
          }}
        />
      </div>
    {/if}
    {#each children as child (child.path)}
      <FileNode entry={child} depth={depth + 1} />
    {/each}
  {/if}
</div>
