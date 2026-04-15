<script lang="ts">
  import { marked } from 'marked';

  let { content }: { content: string; filePath: string | null } = $props();

  const html = $derived(marked.parse(content) as string);
</script>

<div
  class="markdown-preview h-full w-full overflow-y-auto px-6 py-5 text-sm leading-relaxed text-foreground"
>
  {@html html}
</div>

<style>
  .markdown-preview :global(h1),
  .markdown-preview :global(h2),
  .markdown-preview :global(h3),
  .markdown-preview :global(h4),
  .markdown-preview :global(h5),
  .markdown-preview :global(h6) {
    font-weight: 600;
    margin-top: 1.25em;
    margin-bottom: 0.5em;
    line-height: 1.3;
  }
  .markdown-preview :global(h1) { font-size: 1.6em; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); padding-bottom: 0.25em; }
  .markdown-preview :global(h2) { font-size: 1.3em; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); padding-bottom: 0.2em; }
  .markdown-preview :global(h3) { font-size: 1.1em; }

  .markdown-preview :global(p) {
    margin: 0.75em 0;
  }

  .markdown-preview :global(a) {
    color: hsl(var(--primary));
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .markdown-preview :global(code) {
    font-family: ui-monospace, monospace;
    font-size: 0.85em;
    background: color-mix(in srgb, currentColor 10%, transparent);
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }

  .markdown-preview :global(pre) {
    background: color-mix(in srgb, currentColor 8%, transparent);
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    border-radius: 6px;
    padding: 1em;
    overflow-x: auto;
    margin: 1em 0;
  }

  .markdown-preview :global(pre code) {
    background: none;
    padding: 0;
    font-size: 0.9em;
  }

  .markdown-preview :global(blockquote) {
    border-left: 3px solid color-mix(in srgb, currentColor 25%, transparent);
    margin: 1em 0;
    padding: 0.25em 1em;
    color: color-mix(in srgb, currentColor 70%, transparent);
  }

  .markdown-preview :global(ul),
  .markdown-preview :global(ol) {
    padding-left: 1.5em;
    margin: 0.75em 0;
  }

  .markdown-preview :global(li) {
    margin: 0.25em 0;
  }

  .markdown-preview :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 0.9em;
  }

  .markdown-preview :global(th),
  .markdown-preview :global(td) {
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    padding: 0.4em 0.75em;
    text-align: left;
  }

  .markdown-preview :global(th) {
    background: color-mix(in srgb, currentColor 6%, transparent);
    font-weight: 600;
  }

  .markdown-preview :global(tr:hover td) {
    background: color-mix(in srgb, currentColor 4%, transparent);
  }

  .markdown-preview :global(hr) {
    border: none;
    border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    margin: 1.5em 0;
  }

  .markdown-preview :global(img) {
    max-width: 100%;
    border-radius: 4px;
  }
</style>
