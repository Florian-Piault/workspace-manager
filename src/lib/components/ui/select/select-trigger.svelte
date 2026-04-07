<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Select as SelectPrimitive } from 'bits-ui';
  import { ChevronDown } from '@lucide/svelte';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: SelectPrimitive.TriggerProps & { class?: string } = $props();
</script>

<SelectPrimitive.Trigger
  bind:ref
  class={cn(
    'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground',
    'hover:bg-accent hover:text-accent-foreground transition-colors outline-none',
    'focus-visible:ring-1 focus-visible:ring-ring',
    className
  )}
  {...restProps}
>
  {@render children?.()}
  <ChevronDown class="h-3 w-3 opacity-60 flex-shrink-0" />
</SelectPrimitive.Trigger>
