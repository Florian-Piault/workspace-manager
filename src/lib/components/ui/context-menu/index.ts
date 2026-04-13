import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
import Content from "./context-menu-content.svelte";

const Root = ContextMenuPrimitive.Root;
const Trigger = ContextMenuPrimitive.Trigger;
const Item = ContextMenuPrimitive.Item;
const Separator = ContextMenuPrimitive.Separator;

export {
	Root,
	Content,
	Trigger,
	Item,
	Separator,
	//
	Root as ContextMenu,
	Content as ContextMenuContent,
	Trigger as ContextMenuTrigger,
	Item as ContextMenuItem,
	Separator as ContextMenuSeparator,
};
