import { isPanel } from './types';
import type { Panel, PanelNode, WidgetType } from './types';

function mapNode(
  panel: Panel,
  targetId: string,
  mapper: (node: PanelNode) => PanelNode
): Panel {
  return {
    ...panel,
    children: panel.children.map((child) => {
      if (child.id === targetId) return mapper(child);
      if (isPanel(child)) return mapNode(child, targetId, mapper);
      return child;
    }),
  };
}

function removeNode(panel: Panel, targetId: string): Panel {
  const newChildren: PanelNode[] = panel.children.flatMap((child) => {
    if (child.id === targetId) return [];
    if (isPanel(child)) {
      const updated = removeNode(child, targetId);
      if (updated.children.length === 1) return [updated.children[0]];
      return [updated];
    }
    return [child];
  });
  return { ...panel, children: newChildren };
}

export function splitPanel(
  root: Panel,
  targetId: string,
  direction: 'horizontal' | 'vertical'
): Panel {
  return mapNode(root, targetId, (node) => ({
    id: crypto.randomUUID(),
    direction,
    sizes: [50, 50],
    children: [node, { id: crypto.randomUUID(), type: 'empty' as const, config: {} }],
  }));
}

export function assignWidget(
  root: Panel,
  targetId: string,
  type: Exclude<WidgetType, 'empty'>
): Panel {
  return mapNode(root, targetId, () => ({ id: targetId, type, config: {} }));
}

export function closePanel(root: Panel, targetId: string): Panel {
  return removeNode(root, targetId);
}

export function makeInitialRoot(): Panel {
  return {
    id: crypto.randomUUID(),
    direction: 'horizontal',
    sizes: [100],
    children: [{ id: crypto.randomUUID(), type: 'empty', config: {} }],
  };
}

export function updateNodeConfig(
  root: Panel,
  targetId: string,
  config: Record<string, unknown>
): Panel {
  return mapNode(root, targetId, (node) => {
    if (isPanel(node)) return node;
    return { ...node, config: { ...node.config, ...config } };
  });
}
