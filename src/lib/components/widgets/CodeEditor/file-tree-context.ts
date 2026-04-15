import { getContext, setContext } from 'svelte';
import type { SvelteMap, SvelteSet } from 'svelte/reactivity';

/**
 * Shared state + handlers for the recursive `FileNode` tree.
 *
 * Goal: avoid prop-drilling identity-coupled values (callbacks, configs, state)
 * through every level of the recursion. The identity of prop drills would force
 * every descendant to re-evaluate its derived values whenever the parent
 * re-ran — regardless of whether anything relevant to that node changed.
 *
 * All mutable values are exposed as getters so consumers tracking them inside
 * reactive scopes (`$derived`, `$effect`, template expressions) subscribe to
 * the underlying signals without carrying the whole context object in their
 * dependency graph.
 */

export interface PendingCreate {
  parentPath: string;
  type: 'file' | 'dir';
}

export interface FileTreeContext {
  // Static / rarely changing values
  readonly workspaceRoot: string;
  readonly showHiddenFiles: boolean;
  readonly excludePatterns: string[];

  // Fine-grained reactive values
  readonly activeFilePath: string | null;
  readonly pendingCreate: PendingCreate | null;
  readonly expanded: SvelteSet<string>; // fine-grained per-path `has()` tracking
  readonly refreshKeys: SvelteMap<string, number>; // fine-grained per-path `get()` tracking

  // Stable handlers (captured once from the parent widget)
  onFileClick(path: string): void;
  onToggleFolder(path: string, open: boolean): void;
  onCreateFile(parentPath: string): void;
  onCreateDirectory(parentPath: string): void;
  onRename(path: string, newName: string): void;
  onDelete(path: string, isDir: boolean): void;
  onConfirmCreate(name: string): void;
  onCancelCreate(): void;
}

const FILE_TREE_KEY = Symbol('file-tree-context');

export function setFileTreeContext(ctx: FileTreeContext): void {
  setContext(FILE_TREE_KEY, ctx);
}

export function getFileTreeContext(): FileTreeContext {
  const ctx = getContext<FileTreeContext | undefined>(FILE_TREE_KEY);
  if (!ctx) {
    throw new Error(
      'FileTreeContext missing — wrap FileNode with a provider (see CodeEditorWidget).'
    );
  }
  return ctx;
}

/**
 * Icon lookup table — built once at module load, not per-render.
 */
export const FILE_ICON_EXTENSIONS = {
  code: new Set([
    'ts',
    'tsx',
    'js',
    'jsx',
    'svelte',
    'rs',
    'py',
    'go',
    'json',
    'toml',
    'yaml',
    'yml',
  ]),
  text: new Set(['md', 'txt']),
};
