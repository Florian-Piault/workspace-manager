import { describe, it, expect } from 'vitest';
import { splitPanel, closePanel, assignWidget, updateNodeConfig } from './layout';
import { isPanel } from './types';
import type { Panel, Widget, PanelNode } from './types';

const w = (id: string, type: 'code' | 'terminal' | 'browser' | 'empty' = 'code'): Widget => ({
  id,
  type,
  config: {},
});

const p = (id: string, children: PanelNode[]): Panel => ({
  id,
  direction: 'horizontal',
  sizes: children.map(() => Math.floor(100 / children.length)),
  children,
});

describe('splitPanel', () => {
  it('wraps target in a new Panel with an EmptyWidget sibling', () => {
    const root = p('root', [w('w1')]);
    const result = splitPanel(root, 'w1', 'vertical');

    expect(result.children).toHaveLength(1);
    const inner = result.children[0] as Panel;
    expect(isPanel(inner)).toBe(true);
    expect(inner.direction).toBe('vertical');
    expect(inner.children).toHaveLength(2);
    expect(inner.children[0].id).toBe('w1');
    expect((inner.children[1] as Widget).type).toBe('empty');
  });

  it('works on a nested target', () => {
    const inner = p('inner', [w('w1'), w('w2')]);
    const root = p('root', [inner, w('w3')]);
    const result = splitPanel(root, 'w2', 'horizontal');

    const updatedInner = result.children[0] as Panel;
    const newPanel = updatedInner.children[1] as Panel;
    expect(isPanel(newPanel)).toBe(true);
    expect(newPanel.children[0].id).toBe('w2');
  });
});

describe('closePanel', () => {
  it('removes target and keeps sibling', () => {
    const root = p('root', [w('a'), w('b')]);
    const result = closePanel(root, 'b');

    expect(result.children).toHaveLength(1);
    expect(result.children[0].id).toBe('a');
  });

  it('collapses parent when only 1 child remains after removal', () => {
    const inner = p('inner', [w('a'), w('b')]);
    const root = p('root', [inner, w('c')]);
    const result = closePanel(root, 'b');

    // inner[a,b] → close b → inner[a] → parent collapses inner to a
    expect(result.children).toHaveLength(2);
    expect(result.children[0].id).toBe('a');
    expect(result.children[1].id).toBe('c');
  });
});

describe('assignWidget', () => {
  it('replaces EmptyWidget with the chosen type, keeping same id', () => {
    const root = p('root', [w('w1', 'empty')]);
    const result = assignWidget(root, 'w1', 'terminal');

    const widget = result.children[0] as Widget;
    expect(widget.id).toBe('w1');
    expect(widget.type).toBe('terminal');
  });
});

describe('updateNodeConfig', () => {
  it('met à jour le config du widget ciblé sans changer son type ni son id', () => {
    const root = p('root', [{ id: 'w1', type: 'terminal' as const, config: {} }]);
    const result = updateNodeConfig(root, 'w1', { scrollback: 'abc123' });

    const widget = result.children[0] as Widget;
    expect(widget.id).toBe('w1');
    expect(widget.type).toBe('terminal');
    expect(widget.config).toEqual({ scrollback: 'abc123' });
  });

  it('ne modifie pas les autres nœuds', () => {
    const root = p('root', [w('w1', 'terminal'), w('w2', 'code')]);
    const result = updateNodeConfig(root, 'w1', { scrollback: 'xyz' });

    const other = result.children[1] as Widget;
    expect(other.config).toEqual({});
  });

  it('merge le nouveau config avec le config existant', () => {
    const root = p('root', [{ id: 'w1', type: 'terminal' as const, config: { theme: 'dark' } }]);
    const result = updateNodeConfig(root, 'w1', { scrollback: 'abc123' });

    const widget = result.children[0] as Widget;
    expect(widget.config).toEqual({ theme: 'dark', scrollback: 'abc123' });
  });
});
