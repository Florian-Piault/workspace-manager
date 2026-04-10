<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  export type IconProps = Omit<HTMLAttributes<SVGElement>, 'children'> & {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    children?: import('svelte').Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '$lib/utils.js';

  let {
    size = 24,
    color = 'currentColor',
    strokeWidth = 2,
    fill = 'none',
    stroke = color,
    class: className,
    children,
    ...restProps
  }: IconProps & { fill?: string; stroke?: string } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  {fill}
  {stroke}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={cn('shrink-0', className)}
  {...restProps}
>
  {@render children?.()}
</svg>
