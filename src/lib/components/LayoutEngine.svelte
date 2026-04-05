<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { isPanel } from '$lib/types';
  import type { PanelNode } from '$lib/types';
  import CodeWidget from './widgets/CodeWidget.svelte';
  import TerminalWidget from './widgets/TerminalWidget.svelte';
  import BrowserWidget from './widgets/BrowserWidget.svelte';
  import LayoutEngine from './LayoutEngine.svelte';

  let { node }: { node: PanelNode } = $props();
</script>

{#if isPanel(node)}
  <PaneGroup direction={node.direction} class="h-full w-full">
    {#each node.children as child, i (child.id)}
      <Pane defaultSize={node.sizes[i] ?? Math.floor(100 / node.children.length)}>
        <LayoutEngine node={child} />
      </Pane>
      {#if i < node.children.length - 1}
        <PaneResizer class="w-1 bg-border hover:bg-primary/50 transition-colors" />
      {/if}
    {/each}
  </PaneGroup>
{:else if node.type === 'code'}
  <CodeWidget config={node.config} />
{:else if node.type === 'terminal'}
  <TerminalWidget config={node.config} />
{:else if node.type === 'browser'}
  <BrowserWidget config={node.config} />
{/if}
