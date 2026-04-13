<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		...restProps
	}: ContextMenuPrimitive.ContentProps & {
		portalProps?: ContextMenuPrimitive.PortalProps;
	} = $props();
</script>

<ContextMenuPrimitive.Portal {...portalProps}>
	<ContextMenuPrimitive.Content
		bind:ref
		class={cn(
			"z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
			className
		)}
		{...restProps}
	/>
</ContextMenuPrimitive.Portal>
