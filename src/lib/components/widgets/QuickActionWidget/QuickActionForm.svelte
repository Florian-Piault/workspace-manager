<script lang="ts">
  let {
    onSubmit,
    onCancel,
    title = 'Nouvelle action',
    initial = {}
  }: {
    onSubmit: (label: string, command: string, args: string[], cwd: string | null) => void;
    onCancel: () => void;
    title?: string;
    initial?: { label?: string; command?: string; args?: string; cwd?: string | null };
  } = $props();

  const { label: i_label = '', command: i_command = '', args: i_args = '' } = initial;
  const i_cwd = initial.cwd ?? '';
  let label = $state(i_label);
  let command = $state(i_command);
  let argsRaw = $state(i_args);
  let cwd = $state(i_cwd);

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!label.trim() || !command.trim()) return;
    const args = argsRaw.trim() ? argsRaw.trim().split(/\s+/) : [];
    onSubmit(label.trim(), command.trim(), args, cwd.trim() || null);
  }

  const inputClass = 'w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring';
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-2 border-t border-border bg-muted/20 p-3">
  <span class="text-xs font-semibold text-foreground">{title}</span>

  <div class="flex flex-col gap-1">
    <label for="qa-label" class="text-xs text-muted-foreground">Nom</label>
    <input id="qa-label" bind:value={label} placeholder="ex: Dev server" class={inputClass} required />
  </div>

  <div class="flex flex-col gap-1">
    <label for="qa-command" class="text-xs text-muted-foreground">Commande</label>
    <input id="qa-command" bind:value={command} placeholder="ex: npm" class={inputClass} required />
  </div>

  <div class="flex flex-col gap-1">
    <label for="qa-args" class="text-xs text-muted-foreground">Arguments <span class="text-muted-foreground/50">(séparés par espaces)</span></label>
    <input id="qa-args" bind:value={argsRaw} placeholder="ex: run dev" class={inputClass} />
  </div>

  <div class="flex flex-col gap-1">
    <label for="qa-cwd" class="text-xs text-muted-foreground">Répertoire <span class="text-muted-foreground/50">(optionnel)</span></label>
    <input id="qa-cwd" bind:value={cwd} placeholder="Par défaut : dossier workspace" class={inputClass} />
  </div>

  <div class="flex gap-2">
    <button
      type="submit"
      class="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      Ajouter
    </button>
    <button
      type="button"
      onclick={onCancel}
      class="rounded px-3 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
    >
      Annuler
    </button>
  </div>
</form>
