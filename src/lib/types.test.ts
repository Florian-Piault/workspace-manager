import { describe, it, expect } from 'vitest';
import type { Workspace, Panel, Widget, PanelNode, Layout, WidgetType } from './types';

describe('types', () => {
  it('Widget is a valid PanelNode leaf', () => {
    const widget: Widget = {
      id: 'w1',
      type: 'code' satisfies WidgetType,
      config: { filePath: '/src/main.ts' },
    };
    const node: PanelNode = widget;
    expect(node.id).toBe('w1');
  });

  it('Panel with nested children compiles', () => {
    const leaf: Widget = { id: 'w2', type: 'terminal', config: {} };
    const panel: Panel = {
      id: 'p1',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [leaf],
    };
    const layout: Layout = {
      id: 'l1',
      workspaceId: 'ws1',
      root: panel,
    };
    expect(layout.root.children).toHaveLength(1);
  });

  it('Workspace with null layoutId is valid', () => {
    const ws: Workspace = { id: 'ws1', name: 'Mon Projet', path: '/Users/me/project', layoutId: null };
    expect(ws.layoutId).toBeNull();
  });
});
