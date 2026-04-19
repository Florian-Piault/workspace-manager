/**
 * Registre global de raccourcis clavier.
 *
 * Les composants appellent `registerKeybindAction(action, handler)` (typiquement
 * dans un `$effect`). Le layout racine monte une seule fois le matcher global
 * qui écoute `keydown` en capture-phase et relaie au bon handler.
 *
 * Les combinaisons associées aux actions viennent de `settings.keybinds`.
 */

import { settings } from './settings.svelte';
import { createKeybindMatcher, parseKeybind, type KeybindRegistration } from './utils/keybind';

export type KeybindAction =
  | 'splitHorizontal'
  | 'splitVertical'
  | 'closePanel'
  | 'toggleSidebar'
  | 'saveFile'
  | 'toggleFileTree'
  | 'quickSwitch';

// Liste de handlers par action (permet plusieurs consommateurs, sous réserve que
// leurs conditions de garde internes évitent les doubles déclenchements).
const handlers = new Map<KeybindAction, Set<(e: KeyboardEvent) => void>>();

/**
 * Enregistre un handler pour une action. Retourne une fonction de désinscription.
 *
 * Exemple :
 *   $effect(() => registerKeybindAction('saveFile', () => saveImmediately()));
 */
export function registerKeybindAction(
  action: KeybindAction,
  handler: (e: KeyboardEvent) => void
): () => void {
  let set = handlers.get(action);
  if (!set) {
    set = new Set();
    handlers.set(action, set);
  }
  set.add(handler);
  return () => {
    set!.delete(handler);
    if (set!.size === 0) handlers.delete(action);
  };
}

function buildRegistrations(): KeybindRegistration[] {
  const regs: KeybindRegistration[] = [];
  const keybinds = settings.keybinds;
  for (const [action, handlerSet] of handlers) {
    const raw = keybinds[action as KeybindAction];
    if (!raw) continue;
    const kb = parseKeybind(raw);
    if (!kb) continue;
    for (const h of handlerSet) {
      regs.push({ id: action, keybind: kb, handler: h });
    }
  }
  return regs;
}

let installed = false;
let matcher: ((e: KeyboardEvent) => void) | null = null;

/**
 * Monte le listener global `keydown` (capture-phase). Idempotent.
 * Retourne une fonction de désinstallation.
 */
export function installGlobalKeybindMatcher(): () => void {
  if (installed) return () => {};
  installed = true;
  matcher = createKeybindMatcher(buildRegistrations);
  window.addEventListener('keydown', matcher, { capture: true });
  return () => {
    if (matcher) window.removeEventListener('keydown', matcher, { capture: true });
    matcher = null;
    installed = false;
  };
}
