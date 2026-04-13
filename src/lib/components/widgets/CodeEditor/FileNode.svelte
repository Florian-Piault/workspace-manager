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

  let {
    entry,
    workspaceRoot,
    activeFilePath,
    expandedPaths,
    showHiddenFiles,
    excludePatterns,
    depth = 0,
    refreshKeys,
    pendingCreate,
    crudError,
    onFileClick,
    onToggleFolder,
    onCreateFile,
    onCreateDirectory,
    onRename,
    onDelete,
    onConfirmCreate,
    onCancelCreate
  }: {
    entry: FileEntry;
    workspaceRoot: string;
    activeFilePath: string | null;
    expandedPaths: string[];
    showHiddenFiles: boolean;
    excludePatterns: string[];
    depth?: number;
    refreshKeys?: Record<string, number>;
    pendingCreate?: { parentPath: string; type: 'file' | 'dir' } | null;
    crudError?: string | null;
    onFileClick: (path: string) => void;
    onToggleFolder: (path: string, open: boolean) => void;
    onCreateFile?: (parentPath: string) => void;
    onCreateDirectory?: (parentPath: string) => void;
    onRename?: (path: string, newName: string) => void;
    onDelete?: (path: string, isDir: boolean) => void;
    onConfirmCreate?: (name: string) => void;
    onCancelCreate?: () => void;
  } = $props();

  const isOpen = $derived(expandedPaths.includes(entry.path));
  let children = $state<FileEntry[]>([]);
  let loading = $state(false);

  // Rename inline state
  let isRenaming = $state(false);
  let renameValue = $state('');

  // Focus state for keyboard shortcuts
  let isFocused = $state(false);

  // Compute parent path for the entry
  function getParentPath(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  }

  function getContextMenuParentPath(): string {
    return entry.is_dir ? entry.path : getParentPath(entry.path);
  }

  function getFileIcon(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'svelte':
      case 'rs':
      case 'py':
      case 'go':
      case 'json':
      case 'toml':
      case 'yaml':
      case 'yml':
        return FileCode;
      case 'md':
      case 'txt':
        return FileText;
      default:
        return File;
    }
  }

  async function loadChildren() {
    loading = true;
    try {
      children = await invoke<FileEntry[]>('get_directory_contents', {
        path: entry.path,
        workspaceRoot,
        showHiddenFiles,
        excludePatterns
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
      onToggleFolder(entry.path, !isOpen);
    } else {
      onFileClick(entry.path);
    }
  }

  // Re-load children when folder becomes open and children are stale
  $effect(() => {
    if (isOpen && children.length === 0) {
      loadChildren();
    }
  });

  // Reload children when parent bumps the refreshKey for this directory
  $effect(() => {
    if (!entry.is_dir) return;
    const key = refreshKeys?.[entry.path];
    if (key !== undefined && key > 0) {
      children = [];
    }
  });

  const isActive = $derived(!entry.is_dir && entry.path === activeFilePath);
  const FileIcon = $derived(getFileIcon(entry.name));
  const paddingLeft = $derived(`${depth * 12 + 8}px`);

  function handleNodeKeydown(e: KeyboardEvent) {
    if (isRenaming) return;
    const isDelete = e.key === 'Delete' || (e.metaKey && e.key === 'Backspace');
    if (isDelete) {
      e.preventDefault();
      onDelete?.(entry.path, entry.is_dir);
    }
  }

  function startRename() {
    renameValue = entry.name;
    isRenaming = true;
  }

  function confirmRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== entry.name) {
      onRename?.(entry.path, trimmed);
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
        onclick={() => onCreateFile?.(getContextMenuParentPath())}
        class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-accent"
      >
        <FilePlus class="h-3.5 w-3.5" />
        Nouveau fichier
      </ContextMenu.Item>
      <ContextMenu.Item
        onclick={() => onCreateDirectory?.(getContextMenuParentPath())}
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
        onclick={() => onDelete?.(entry.path, entry.is_dir)}
        class="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded hover:bg-accent hover:text-primary-foreground text-destructive"
      >
        <Trash2 class="h-3.5 w-3.5" />
        Supprimer
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>

  {#if isOpen}
    {#if pendingCreate?.parentPath === entry.path}
      <div
        class="flex items-center gap-1.5 py-0.5 pr-2"
        style="padding-left: {(depth + 1) * 12 + 8}px"
      >
        {#if pendingCreate.type === 'file'}
          <span class="w-3.5 shrink-0"></span>
          <File class="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        {:else}
          <span class="w-3.5 shrink-0"></span>
          <Folder class="h-3.5 w-3.5 shrink-0 text-blue-400/80" />
        {/if}
        <input
          autofocus
          class="bg-transparent border-b border-primary outline-none text-sm flex-1 min-w-0"
          placeholder={pendingCreate.type === 'file'
            ? 'nouveau-fichier.ts'
            : 'nouveau-dossier'}
          onblur={e => {
            if (!(e.currentTarget as HTMLInputElement).value.trim()) {
              onCancelCreate?.();
            }
          }}
          onkeydown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              onConfirmCreate?.(
                (e.currentTarget as HTMLInputElement).value.trim()
              );
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancelCreate?.();
            }
          }}
        />
      </div>
    {/if}
    {#each children as child (child.path)}
      <FileNode
        entry={child}
        {workspaceRoot}
        {activeFilePath}
        {expandedPaths}
        {showHiddenFiles}
        {excludePatterns}
        depth={depth + 1}
        {refreshKeys}
        {pendingCreate}
        {crudError}
        {onFileClick}
        {onToggleFolder}
        {onCreateFile}
        {onCreateDirectory}
        {onRename}
        {onDelete}
        {onConfirmCreate}
        {onCancelCreate}
      />
    {/each}
  {/if}
</div>
