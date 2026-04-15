<script lang="ts">
  let { content }: { content: string; filePath: string | null } = $props();

  // Simple CSV parser: handles quoted fields with commas inside
  function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  const rows = $derived.by(() => {
    const lines = content.trim().split('\n').filter(l => l.trim() !== '');
    return lines.map(parseCsvLine);
  });

  const headers = $derived(rows[0] ?? []);
  const dataRows = $derived(rows.slice(1));
</script>

<div class="h-full w-full overflow-auto">
  {#if rows.length === 0}
    <p class="p-4 text-sm text-muted-foreground">Fichier CSV vide</p>
  {:else}
    <table class="w-full border-collapse text-xs">
      <thead>
        <tr class="sticky top-0 bg-muted/80 backdrop-blur-sm">
          {#each headers as header, i}
            <th
              class="border border-zinc-700 px-3 py-1.5 text-left font-semibold text-muted-foreground"
            >
              {header || `Col ${i + 1}`}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each dataRows as row, ri}
          <tr class="group transition-colors hover:bg-zinc-900/60">
            {#each headers as _, ci}
              <td
                class="border border-zinc-700/50 px-3 py-1 text-foreground group-hover:border-zinc-600"
              >
                {row[ci] ?? ''}
              </td>
            {/each}
          </tr>
          <!-- Striped rows for readability -->
          {#if ri % 2 === 0}
            <!-- even rows: default bg -->
          {/if}
        {/each}
      </tbody>
    </table>
  {/if}
</div>
