export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface CodeEditorConfig {
  rootPath: string | null;
  activeFilePath: string | null;
  sidebarWidth: number;
  treeHidden?: boolean;
  language?: string | null;
  expandedFolders?: string[];
  // Per-widget editor overrides (null = use global setting)
  lineNumbers?: boolean | null;
  wordWrap?: boolean | null;
  highlightActiveLine?: boolean | null;
  fontSize?: number | null;
  readOnly?: boolean | null;
  indentUnit?: 2 | 4 | 8 | null;
  autocompletion?: boolean | null;
  lint?: boolean | null;
  editorTheme?: string | null;
  // Per-widget filesystem overrides (null = use global setting)
  showHiddenFiles?: boolean | null;
  excludePatterns?: string[] | null;
}
