export type WidgetType = 'code' | 'terminal' | 'browser' | 'empty';

export interface Widget {
  id: string;
  type: WidgetType;
  config: Record<string, unknown>;
}

export interface Panel {
  id: string;
  direction: 'horizontal' | 'vertical';
  sizes: number[];        // tailles en % pour paneforge
  children: PanelNode[];
}

export type PanelNode = Panel | Widget;

export interface Layout {
  id: string;
  workspaceId: string;
  root: Panel;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  layoutId: string | null;
}

// Type guard : distingue Panel de Widget
export function isPanel(node: PanelNode): node is Panel {
  return 'children' in node;
}
