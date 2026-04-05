<script lang="ts">
  let { config }: { config: Record<string, unknown> } = $props();
</script>

<div class="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground">
  <span class="text-sm">Code Editor — {JSON.stringify(config)}</span>
</div>
