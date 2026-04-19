<script lang="ts">
  import { FileSearch, ArrowLeft } from '@lucide/svelte';
  import { fly } from 'svelte/transition';

  type DiffLineType = 'header' | 'hunk' | 'added' | 'removed' | 'context' | 'noNewline';

  interface DiffLine {
    type: DiffLineType;
    content: string;
    oldNo: number | null;
    newNo: number | null;
  }

  let {
    content,
    file,
    staged,
    narrowMode = false,
    onBack
  }: {
    content: string | null;
    file: string | null;
    staged: boolean;
    narrowMode?: boolean;
    onBack?: () => void;
  } = $props();

  function parseDiff(raw: string): DiffLine[] {
    const lines = raw.split('\n');
    const result: DiffLine[] = [];
    let oldNo = 0;
    let newNo = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (m) { oldNo = parseInt(m[1]) - 1; newNo = parseInt(m[2]) - 1; }
        result.push({ type: 'hunk', content: line, oldNo: null, newNo: null });
      } else if (
        line.startsWith('diff ') || line.startsWith('index ') ||
        line.startsWith('--- ') || line.startsWith('+++ ')
      ) {
        result.push({ type: 'header', content: line, oldNo: null, newNo: null });
      } else if (line.startsWith('+')) {
        newNo++;
        result.push({ type: 'added', content: line.slice(1), oldNo: null, newNo });
      } else if (line.startsWith('-')) {
        oldNo++;
        result.push({ type: 'removed', content: line.slice(1), oldNo, newNo: null });
      } else if (line.startsWith(' ')) {
        oldNo++; newNo++;
        result.push({ type: 'context', content: line.slice(1), oldNo, newNo });
      } else if (line.startsWith('\\')) {
        result.push({ type: 'noNewline', content: line, oldNo: null, newNo: null });
      }
    }
    return result;
  }

  const lines = $derived(content ? parseDiff(content) : []);

  const addedCount = $derived(lines.filter(l => l.type === 'added').length);
  const removedCount = $derived(lines.filter(l => l.type === 'removed').length);

  const shortFile = $derived(file ? file.split('/').pop() ?? file : null);
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
  {#if !file}
    <!-- Empty state -->
    <div class="flex h-full flex-col items-center justify-center gap-2">
      <FileSearch class="h-6 w-6 text-muted-foreground/20" />
      <span class="text-xs text-muted-foreground/40">Sélectionner un fichier</span>
    </div>
  {:else}
    <!-- Diff header -->
    <div class="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2">
      {#if narrowMode && onBack}
        <button
          onclick={onBack}
          aria-label="Retour à la liste"
          class="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft class="h-3.5 w-3.5" />
        </button>
      {/if}
      <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
        {file}
      </span>
      {#if addedCount > 0 || removedCount > 0}
        <span class="shrink-0 font-mono text-[10px]">
          {#if addedCount > 0}<span class="text-primary">+{addedCount}</span>{/if}
          {#if removedCount > 0}<span class="ml-0.5 text-destructive">-{removedCount}</span>{/if}
        </span>
      {/if}
      <span class="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
        {staged ? 'staged' : 'unstaged'}
      </span>
    </div>

    <!-- Diff lines -->
    {#key file}
      <div
        class="min-h-0 flex-1 overflow-auto"
        in:fly={{ x: 8, duration: 120 }}
      >
        {#if lines.length === 0}
          <div class="flex h-full items-center justify-center">
            <span class="text-xs text-muted-foreground/40">Aucune différence</span>
          </div>
        {:else}
          <table class="w-full border-collapse font-mono text-xs">
            <tbody>
              {#each lines as line}
                {#if line.type === 'header'}
                  <!-- skip file headers -->
                {:else if line.type === 'hunk'}
                  <tr class="bg-muted/60">
                    <td colspan="3" class="px-2 py-0.5 text-[10px] italic text-muted-foreground/60 select-none">
                      {line.content}
                    </td>
                  </tr>
                {:else if line.type === 'added'}
                  <tr class="border-l-2 border-primary/50 bg-primary/5">
                    <td class="w-8 select-none border-r border-border/30 pr-1 text-right text-[10px] tabular-nums text-muted-foreground/30">
                      {line.oldNo ?? ''}
                    </td>
                    <td class="w-8 select-none border-r border-border/30 pr-1 text-right text-[10px] tabular-nums text-muted-foreground/40">
                      {line.newNo ?? ''}
                    </td>
                    <td class="whitespace-pre pl-2 text-foreground">{line.content}</td>
                  </tr>
                {:else if line.type === 'removed'}
                  <tr class="border-l-2 border-destructive/50 bg-destructive/5">
                    <td class="w-8 select-none border-r border-border/30 pr-1 text-right text-[10px] tabular-nums text-muted-foreground/40">
                      {line.oldNo ?? ''}
                    </td>
                    <td class="w-8 select-none border-r border-border/30 pr-1 text-right text-[10px] tabular-nums text-muted-foreground/30">
                      {line.newNo ?? ''}
                    </td>
                    <td class="whitespace-pre pl-2 text-foreground">{line.content}</td>
                  </tr>
                {:else if line.type === 'context'}
                  <tr>
                    <td class="w-8 select-none border-r border-border/30 pr-1 text-right text-[10px] tabular-nums text-muted-foreground/30">
                      {line.oldNo ?? ''}
                    </td>
                    <td class="w-8 select-none border-r border-border/30 pr-1 text-right text-[10px] tabular-nums text-muted-foreground/30">
                      {line.newNo ?? ''}
                    </td>
                    <td class="whitespace-pre pl-2 text-muted-foreground/70">{line.content}</td>
                  </tr>
                {:else if line.type === 'noNewline'}
                  <tr>
                    <td colspan="3" class="pl-2 text-[10px] italic text-muted-foreground/40 select-none">
                      {line.content}
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/key}
  {/if}
</div>
