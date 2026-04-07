<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { Select as SelectPrimitive } from 'bits-ui';
  import { Check } from '@lucide/svelte';

  let {
    ref = $bindable(null),
    class: className,
    value,
    label,
    ...restProps
  }: SelectPrimitive.ItemProps & { class?: string; label: string } = $props();
</script>

<SelectPrimitive.Item
  bind:ref
  {value}
  class={cn(
    'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1 pl-6 pr-2 text-xs outline-none',
    'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    className
  )}
  {...restProps}
>
  {#snippet children({ selected })}
    {#if selected}
      <span class="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
        <Check class="h-3 w-3" />
      </span>
    {/if}
    {label}
  {/snippet}
</SelectPrimitive.Item>
