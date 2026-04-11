export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface ExplorerEditorConfig {
  rootPath: string | null;
  activeFilePath: string | null;
  sidebarWidth: number;
  treeHidden?: boolean;
}
