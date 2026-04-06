<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { isPanel } from '$lib/types';
  import type { PanelNode, Widget } from '$lib/types';
  import CodeWidget from './widgets/CodeWidget.svelte';
  import TerminalWidget from './widgets/TerminalWidget.svelte';
  import BrowserWidget from './widgets/BrowserWidget.svelte';
  import WidgetPicker from './WidgetPicker.svelte';
  import PanelOverlay from './PanelOverlay.svelte';
  import LayoutEngine from './LayoutEngine.svelte';
  import { store } from '$lib/state.svelte';

  let { node, isRoot = false }: { node: PanelNode; isRoot?: boolean } = $props();
</script>

{#if isPanel(node)}
  {#if node.children.length === 0}
    <WidgetPicker nodeId={node.id} />
  {:else}
    <PaneGroup direction={node.direction} class="h-full w-full" onLayoutChange={(sizes) => store.updatePanelSizes(node.id, sizes)}>
      {#each node.children as child, i (child.id)}
        <Pane defaultSize={node.sizes[i] ?? Math.floor(100 / node.children.length)}>
          <LayoutEngine
            node={child}
            isRoot={isRoot && node.children.length === 1}
          />
        </Pane>
        {#if i < node.children.length - 1}
          <PaneResizer class="{node.direction === 'horizontal' ? 'w-1' : 'h-1'} bg-border hover:bg-primary/50 transition-colors" />
        {/if}
      {/each}
    </PaneGroup>
  {/if}
{:else}
  <PanelOverlay nodeId={node.id} {isRoot} widget={node as Widget}>
    {#if node.type === 'empty'}
      <WidgetPicker nodeId={node.id} />
    {:else if node.type === 'code'}
      <CodeWidget config={node.config} nodeId={node.id} />
    {:else if node.type === 'terminal'}
      <TerminalWidget config={node.config} nodeId={node.id} />
    {:else if node.type === 'browser'}
      <BrowserWidget config={node.config} />
    {/if}
  </PanelOverlay>
{/if}
