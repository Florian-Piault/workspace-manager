<script lang="ts">
  let {
    stagedCount,
    onCommit
  }: {
    stagedCount: number;
    onCommit: (message: string) => Promise<void>;
  } = $props();

  let message = $state('');
  let committing = $state(false);

  const subjectLine = $derived(message.split('\n')[0] ?? '');
  const overLimit = $derived(subjectLine.length > 50);
  const canCommit = $derived(stagedCount > 0 && message.trim().length > 0 && !committing);

  async function handleCommit() {
    if (!canCommit) return;
    committing = true;
    try {
      await onCommit(message.trim());
      message = '';
    } finally {
      committing = false;
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    }
  }
</script>

<div class="shrink-0 border-t border-border bg-muted/20 p-2 flex flex-col gap-1.5">
  <div class="relative">
    <textarea
      bind:value={message}
      {onkeydown}
      placeholder="Message de commit…"
      rows={3}
      aria-label="Message de commit"
      class="w-full resize-none rounded-sm border border-border bg-transparent px-2 py-1.5
             font-mono text-xs text-foreground placeholder:text-muted-foreground/50
             focus:outline-none focus:ring-1 focus:ring-ring"
    ></textarea>
    {#if subjectLine.length > 40}
      <span
        class="absolute bottom-2 right-2 font-mono text-[10px] tabular-nums
               {overLimit ? 'text-destructive/70' : 'text-muted-foreground/40'}"
      >
        {subjectLine.length}/72
      </span>
    {/if}
  </div>

  <div class="flex items-center justify-end">
    <button
      onclick={handleCommit}
      disabled={!canCommit}
      class="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1 text-xs
             text-primary-foreground transition-opacity
             disabled:opacity-40 disabled:cursor-not-allowed
             {committing ? 'animate-pulse opacity-70' : 'hover:bg-primary/90'}"
    >
      Commit
      {#if stagedCount > 0}
        <span class="opacity-70">({stagedCount})</span>
      {/if}
      <kbd class="ml-1 font-mono text-[10px] opacity-50">⌘↵</kbd>
    </button>
  </div>
</div>
