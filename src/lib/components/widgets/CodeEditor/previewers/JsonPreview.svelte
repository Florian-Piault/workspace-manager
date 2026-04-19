<script lang="ts">
  let { content }: { content: string; filePath: string | null } = $props();

  type JsonNode = string | number | boolean | null | JsonNode[] | { [k: string]: JsonNode };

  const parsed = $derived.by<{ ok: true; value: JsonNode } | { ok: false; error: string }>(() => {
    try {
      return { ok: true, value: JSON.parse(content) as JsonNode };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
</script>

<div class="h-full w-full overflow-y-auto p-4 font-mono text-xs leading-relaxed">
  {#if parsed.ok}
    {@render node(parsed.value, 0)}
  {:else}
    <div class="rounded border border-destructive/40 bg-destructive/10 p-3 text-destructive">
      <span class="font-semibold">JSON invalide :</span>
      {parsed.error}
    </div>
  {/if}
</div>

{#snippet node(value: JsonNode, depth: number)}
  {#if value === null}
    <span class="text-orange-400">null</span>
  {:else if typeof value === 'boolean'}
    <span class="text-blue-400">{String(value)}</span>
  {:else if typeof value === 'number'}
    <span class="text-green-400">{value}</span>
  {:else if typeof value === 'string'}
    <span class="text-amber-300">"{value}"</span>
  {:else if Array.isArray(value)}
    {#if value.length === 0}
      <span class="text-muted-foreground">[]</span>
    {:else}
      <details open={depth < 2} class="inline-block align-top">
        <summary class="cursor-pointer select-none text-muted-foreground hover:text-foreground">
          [{value.length}]
        </summary>
        <div class="ml-4 border-l border-border pl-3">
          {#each value as item, i}
            <div class="py-0.5">
              <span class="text-muted-foreground/60">{i}: </span>
              {@render node(item, depth + 1)}
              {#if i < value.length - 1}<span class="text-muted-foreground">,</span>{/if}
            </div>
          {/each}
        </div>
      </details>
    {/if}
  {:else if typeof value === 'object'}
    {@const entries = Object.entries(value)}
    {#if entries.length === 0}
      <span class="text-muted-foreground">{'{}'}</span>
    {:else}
      <details open={depth < 2} class="inline-block align-top">
        <summary class="cursor-pointer select-none text-muted-foreground hover:text-foreground">
          {'{' + entries.length + '}'}
        </summary>
        <div class="ml-4 border-l border-border pl-3">
          {#each entries as [key, val], i}
            <div class="py-0.5">
              <span class="text-violet-400">"{key}"</span>
              <span class="text-muted-foreground">: </span>
              {@render node(val, depth + 1)}
              {#if i < entries.length - 1}<span class="text-muted-foreground">,</span>{/if}
            </div>
          {/each}
        </div>
      </details>
    {/if}
  {/if}
{/snippet}
