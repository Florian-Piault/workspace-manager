import { isPanel } from './types';
import type { Panel, PanelNode, Widget, WidgetType } from './types';

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
  const result = removeNode(root, targetId);
  if (result.children.length === 0) {
    return makeInitialRoot();
  }
  return result;
}

export function makeInitialRoot(): Panel {
  return {
    id: crypto.randomUUID(),
    direction: 'horizontal',
    sizes: [100],
    children: [{ id: crypto.randomUUID(), type: 'empty', config: {} }],
  };
}

export function nodeExists(root: Panel, targetId: string): boolean {
  for (const child of root.children) {
    if (child.id === targetId) return true;
    if (isPanel(child) && nodeExists(child, targetId)) return true;
  }
  return false;
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

export function getWidgetDisplayName(widget: Widget, autoLabels: Map<string, string>): string {
  return widget.label ?? autoLabels.get(widget.id) ?? widget.type;
}

export function flatWidgets(root: Panel): Widget[] {
  const result: Widget[] = [];
  for (const child of root.children) {
    if (isPanel(child)) {
      result.push(...flatWidgets(child));
    } else if (child.type !== 'empty') {
      result.push(child);
    }
  }
  return result;
}

export function updatePanelSizes(root: Panel, targetId: string, sizes: number[]): Panel {
  if (root.id === targetId) {
    // Retourner la même référence si rien n'a changé → empêche les re-renders inutiles
    if (root.sizes.length === sizes.length && root.sizes.every((s, i) => s === sizes[i])) return root;
    return { ...root, sizes };
  }
  let changed = false;
  const newChildren = root.children.map((child) => {
    if (!isPanel(child)) return child;
    const updated = updatePanelSizes(child, targetId, sizes);
    if (updated !== child) changed = true;
    return updated;
  });
  // Partage structurel : pas de nouvel objet si aucun enfant n'a changé
  return changed ? { ...root, children: newChildren } : root;
}

export function updateWidgetLabel(root: Panel, targetId: string, label: string): Panel {
  return mapNode(root, targetId, (node) => {
    if (isPanel(node)) return node;
    return { ...(node as Widget), label: label || undefined };
  });
}

export type DropSide = 'top' | 'bottom' | 'left' | 'right' | 'center';

function findWidgetById(panel: Panel, id: string): Widget | null {
  for (const child of panel.children) {
    if (!isPanel(child) && child.id === id) return child;
    if (isPanel(child)) {
      const found = findWidgetById(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function swapWidgetContents(root: Panel, idA: string, idB: string): Panel {
  const a = findWidgetById(root, idA);
  const b = findWidgetById(root, idB);
  if (!a || !b) return root;
  let result = mapNode(root, idA, () => ({ id: idA, type: b.type, config: b.config, label: b.label }));
  result = mapNode(result, idB, () => ({ id: idB, type: a.type, config: a.config, label: a.label }));
  return result;
}

export function findPanelById(root: Panel, targetId: string): Panel | null {
  if (root.id === targetId) return root;
  for (const child of root.children) {
    if (isPanel(child)) {
      const found = findPanelById(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

export function moveWidgetNode(root: Panel, sourceId: string, targetId: string, side: DropSide): Panel {
  if (side === 'center') return swapWidgetContents(root, sourceId, targetId);

  const sourceWidget = findWidgetById(root, sourceId);
  if (!sourceWidget) return root;

  const direction = side === 'left' || side === 'right' ? 'horizontal' : 'vertical';
  const sourceFirst = side === 'left' || side === 'top';
  const movedWidget: Widget = { ...sourceWidget, id: crypto.randomUUID() };

  // Remove source (collapses single-child panels automatically)
  const withoutSource = removeNode(root, sourceId);
  if (withoutSource.children.length === 0) return makeInitialRoot();

  // Wrap target in a new panel alongside the moved widget
  return mapNode(withoutSource, targetId, (target) => ({
    id: crypto.randomUUID(),
    direction,
    sizes: [50, 50],
    children: sourceFirst ? [movedWidget, target] : [target, movedWidget],
  } as Panel));
}
