export interface FileStatus {
  path: string;
  status: string;
}

export interface GitStatus {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

export interface AheadBehind {
  ahead: number;
  behind: number;
}

export interface SelectedFile {
  path: string;
  staged: boolean;
}

export interface CommitInfo {
  hash: string;
  short_hash: string;
  message: string;
  author_name: string;
  timestamp: number;
  refs: string[];
  parent_count: number;
}

export interface GraphRefInfo {
  name: string;
  kind: 'head' | 'local' | 'remote' | 'tag' | 'other';
  checkout_target?: string;
}

export interface GraphLine {
  from_lane: number;
  to_lane: number;
  kind: 'vertical' | 'fork' | 'merge' | 'horizontal';
}

export interface GraphCommitInfo {
  hash: string;
  short_hash: string;
  message: string;
  author_name: string;
  timestamp: number;
  refs: GraphRefInfo[];
  parent_count: number;
  parent_hashes: string[];
  lane: number;
  node_kind: 'commit' | 'merge' | 'head';
  lines: GraphLine[];
}

export interface OpResult {
  op: string;
  output: string;
  success: boolean;
}
