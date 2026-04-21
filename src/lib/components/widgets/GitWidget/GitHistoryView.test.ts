import '@testing-library/svelte/vitest';
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import GitHistoryView from './GitHistoryView.svelte';
import type { GraphCommitInfo } from './types';

function makeCommit(overrides: Partial<GraphCommitInfo> = {}): GraphCommitInfo {
  return {
    hash: 'abcdef1234567890',
    short_hash: 'abcdef1',
    message: 'Add graph view',
    author_name: 'Pi',
    timestamp: Math.floor(Date.now() / 1000) - 60,
    refs: [],
    parent_count: 1,
    parent_hashes: ['1234567890abcdef'],
    lane: 0,
    node_kind: 'commit',
    lines: [{ from_lane: 0, to_lane: 0, kind: 'vertical' }],
    ...overrides
  };
}

describe('GitHistoryView graph', () => {
  it('renders loading state', () => {
    render(GitHistoryView, {
      commits: [],
      loading: true,
      onCheckoutRef: vi.fn(),
      onCopyHash: vi.fn(),
      onCreateBranchFromCommit: vi.fn()
    });

    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders empty state', () => {
    render(GitHistoryView, {
      commits: [],
      loading: false,
      onCheckoutRef: vi.fn(),
      onCopyHash: vi.fn(),
      onCreateBranchFromCommit: vi.fn()
    });

    expect(screen.getByText('Aucun commit')).toBeTruthy();
  });

  it('renders graph node, refs and actions for a commit row', () => {
    render(GitHistoryView, {
      commits: [makeCommit({ refs: [{ name: 'main', kind: 'local', checkout_target: 'main' }] })],
      loading: false,
      onCheckoutRef: vi.fn(),
      onCopyHash: vi.fn(),
      onCreateBranchFromCommit: vi.fn()
    });

    expect(screen.getByText('Add graph view')).toBeTruthy();
    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByTestId('graph-node-abcdef1234567890')).toBeTruthy();
    expect(screen.getByRole('button', { name: /checkout main/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy hash abcdef1/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /create branch from abcdef1/i })).toBeTruthy();
  });

  it('renders merge styling and merge lines', () => {
    render(GitHistoryView, {
      commits: [
        makeCommit({
          hash: 'merge1234567890',
          short_hash: 'merge12',
          message: 'Merge feature',
          parent_count: 2,
          node_kind: 'merge',
          lane: 1,
          lines: [
            { from_lane: 1, to_lane: 1, kind: 'vertical' },
            { from_lane: 1, to_lane: 0, kind: 'merge' }
          ]
        })
      ],
      loading: false,
      onCheckoutRef: vi.fn(),
      onCopyHash: vi.fn(),
      onCreateBranchFromCommit: vi.fn()
    });

    expect(screen.getByTestId('graph-node-merge1234567890').getAttribute('data-node-kind')).toBe('merge');
    expect(screen.getByTestId('graph-line-merge1234567890-1').getAttribute('data-line-kind')).toBe('merge');
  });
});
