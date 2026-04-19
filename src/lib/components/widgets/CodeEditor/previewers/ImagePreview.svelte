<script lang="ts">
  import { convertFileSrc } from '@tauri-apps/api/core';

  let { content, filePath }: { content: string; filePath: string | null } = $props();

  const ext = $derived(filePath?.split('.').pop()?.toLowerCase() ?? '');
  const isSvg = $derived(ext === 'svg');
  // For raster images, use Tauri asset protocol to serve the local file
  const assetSrc = $derived(filePath ? convertFileSrc(filePath) : '');
</script>

<!-- Checkerboard background signals transparency for SVGs and PNGs with alpha -->
<div class="checkerboard flex h-full w-full items-center justify-center overflow-auto p-4">
  {#if isSvg}
    <!-- Inline SVG: shows unsaved edits, handles transparent backgrounds -->
    <div class="max-h-full max-w-full [&>svg]:max-h-[80vh] [&>svg]:max-w-full">
      {@html content}
    </div>
  {:else if filePath}
    <img
      src={assetSrc}
      alt={filePath.split('/').pop() ?? ''}
      class="max-h-[80vh] max-w-full rounded object-contain shadow-md"
    />
  {:else}
    <p class="text-sm text-muted-foreground">Aucune image à afficher</p>
  {/if}
</div>

<style>
  /* Classic checkerboard pattern for transparent image backgrounds */
  .checkerboard {
    background-color: #808080;
    background-image:
      linear-gradient(45deg, #666 25%, transparent 25%),
      linear-gradient(-45deg, #666 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #666 75%),
      linear-gradient(-45deg, transparent 75%, #666 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  }
</style>
