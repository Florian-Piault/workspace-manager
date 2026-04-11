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
    File
  } from '@lucide/svelte';
  import type { FileEntry } from './types';

  let {
    entry,
    workspaceRoot,
    activeFilePath,
    depth = 0,
    onFileClick
  }: {
    entry: FileEntry;
    workspaceRoot: string;
    activeFilePath: string | null;
    depth?: number;
    onFileClick: (path: string) => void;
  } = $props();

  let isOpen = $state(false);
  let children = $state<FileEntry[]>([]);
  let loading = $state(false);

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

  async function handleClick() {
    if (entry.is_dir) {
      if (!isOpen && children.length === 0) {
        loading = true;
        try {
          children = await invoke<FileEntry[]>('get_directory_contents', {
            path: entry.path,
            workspaceRoot
          });
        } catch (err) {
          console.error('[FileNode] get_directory_contents failed:', err);
        } finally {
          loading = false;
        }
      }
      isOpen = !isOpen;
    } else {
      onFileClick(entry.path);
    }
  }

  const isActive = $derived(!entry.is_dir && entry.path === activeFilePath);
  const FileIcon = $derived(getFileIcon(entry.name));
  const paddingLeft = $derived(`${depth * 12 + 8}px`);
</script>

<div>
  <button
    class="flex w-full items-center gap-1.5 rounded py-0.5 pr-2 text-sm transition-colors
           {isActive
             ? 'bg-accent text-accent-foreground'
             : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
    style="padding-left: {paddingLeft}"
    onclick={handleClick}
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
    <span class="truncate">{entry.name}</span>
    {#if loading}
      <span class="ml-auto shrink-0 h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent"></span>
    {/if}
  </button>

  {#if isOpen && children.length > 0}
    {#each children as child (child.path)}
      <FileNode
        entry={child}
        {workspaceRoot}
        {activeFilePath}
        depth={depth + 1}
        {onFileClick}
      />
    {/each}
  {/if}
</div>
