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
