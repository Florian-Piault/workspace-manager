# Widget Pill & Sidebar Redesign

**Date:** 2026-04-06  
**Status:** Approved

## Context

The current `PanelOverlay` shows floating split/close buttons on hover in the top-right corner. The `Sidebar` lists workspaces but gives no visibility into the widgets they contain. This spec covers two improvements: a richer widget pill and a sidebar with full workspace/widget management.

## Scope

1. **Widget pill** — compact hover overlay on each panel with label display and inline rename
2. **Sidebar** — flat widget list per workspace, with workspace collapse/rename/close and per-widget close

## Data Model

### `types.ts`

Add optional `label` to `Widget`:

```ts
export interface Widget {
  id: string;
  type: WidgetType;
  label?: string;  // custom name; falls back to type if absent
  config: Record<string, unknown>;
}
```

### `layout.ts`

New utility:

```ts
export function flatWidgets(root: Panel): Widget[]
```

Recursively walks the panel tree and returns all non-empty `Widget` nodes (excludes `Panel` nodes and widgets with `type === 'empty'`).

### `state.svelte.ts`

Three new methods:

```ts
updateWidgetLabel(nodeId: string, label: string): void
// Updates widget.label via a dedicated helper, triggers debounced save.
// Empty string clears the custom label (reverts to type display).

renameWorkspace(workspaceId: string, name: string): void
// Updates workspaces[] in memory and persists via UPDATE SQL.

closeWorkspace(workspaceId: string): void
// Removes workspace from workspaces[], deletes its layout from layouts{},
// and persists via DELETE SQL on both tables.
```

## Components

### `WidgetPill.svelte` (new)

**Props:** `nodeId: string`, `widget: Widget`

**Behavior:**
- Semi-transparent pill positioned top-right, shown only when parent panel is hovered (via Tailwind `group-hover`)
- Displays: type icon + `widget.label ?? widget.type`
- Clicking the label switches it to an inline `<input>` — Enter or blur confirms and calls `store.updateWidgetLabel()`; empty value clears the label
- Action buttons: split horizontal, split vertical, close — same as current `PanelOverlay` actions

### `PanelOverlay.svelte` (refactored)

Retains: active ring indicator, click-to-focus, `isRoot` guard for close button.  
Delegates all action rendering to `<WidgetPill>`, passing the current widget node.

### `SidebarWorkspaceItem.svelte` (new)

**Props:** `workspace: Workspace`

**Behavior:**
- Header row: collapse chevron (local `collapsed` state), workspace name, close button
- Double-click on name → inline rename input → `store.renameWorkspace()` on Enter/blur
- When expanded: flat widget list from `flatWidgets(layout.root)`
  - Per widget: type icon + label (or type fallback) + `✕` button → `store.closePanel(widget.id)`
- `collapsed` is local UI state, not persisted

### `Sidebar.svelte` (refactored)

Iterates `store.workspaces` and renders one `<SidebarWorkspaceItem>` per workspace. Keeps the existing "New workspace" button.

## Data Flow

| Action | Trigger | Handler |
|--------|---------|---------|
| Rename widget | Enter/blur on pill input | `store.updateWidgetLabel(nodeId, label)` |
| Close widget from sidebar | Click `✕` on widget row | `store.closePanel(widget.id)` |
| Rename workspace | Enter/blur on sidebar input | `store.renameWorkspace(id, name)` |
| Close workspace | Click close on workspace header | `store.closeWorkspace(id)` (existing or new) |
| Collapse workspace | Click chevron | local `collapsed` toggle |

## Edge Cases

- **Empty label:** clears `widget.label`, display reverts to `widget.type`
- **Empty widgets (`type === 'empty'`):** excluded from sidebar widget list
- **`flatWidgets` on empty layout:** returns `[]` — sidebar shows no widget rows
- **Close panel from sidebar:** reuses existing `store.closePanel()` — no new logic needed
