/**
 * Keyboard shortcut handling (VSCode-style).
 *
 * Canonical string format: tokens separated by `+`, chords separated by a single space.
 *   "Mod+S"            — simple combo
 *   "Mod+Shift+B"      — with extra modifier
 *   "Mod+K Mod+S"      — two-step chord sequence
 *
 * Modifier tokens (canonical order on output): Mod, Ctrl, Meta, Alt, Shift.
 * `Mod` is a logical modifier that maps to Cmd on macOS and Ctrl on Windows/Linux.
 */

export type Chord = {
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
};

export type Keybind = Chord[];

const MODIFIER_KEY_NAMES = new Set(['Control', 'Meta', 'Alt', 'Shift', 'AltGraph']);

// Named keys we accept without a modifier (F-keys, navigation, etc.).
const ALLOW_WITHOUT_MODIFIER = new Set([
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'Escape', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
]);

function emptyChord(): Chord {
  return { mod: false, ctrl: false, meta: false, alt: false, shift: false, key: '' };
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  // `userAgentData.platform` is more reliable when available, fallback to userAgent.
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData;
  const plat = uaData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/i.test(plat);
}

// ─── Normalisation de touche ──────────────────────────────────────────────────

/** Normalise `e.key` pour stockage/affichage. Lettres en majuscule, touches nommées inchangées. */
function normalizeKey(rawKey: string): string {
  if (rawKey.length === 1) {
    // Lettres ASCII → majuscule stable (indépendant du Shift).
    if (/[a-zA-Z]/.test(rawKey)) return rawKey.toUpperCase();
    return rawKey;
  }
  return rawKey; // "Enter", "ArrowLeft", "F1", etc.
}

/** Compare une touche du binding avec `e.key`. */
function keysMatch(bindingKey: string, eventKey: string): boolean {
  const a = normalizeKey(bindingKey);
  const b = normalizeKey(eventKey);
  return a === b;
}

// ─── Construction depuis un KeyboardEvent ─────────────────────────────────────

/**
 * Transforme un KeyboardEvent en Chord canonique.
 * Retourne `null` si seule une touche modificatrice est pressée.
 *
 * Règle Mod : sur macOS, Cmd=Mod (et Ctrl reste "Ctrl" explicite).
 *             sur Win/Linux, Ctrl=Mod (et Meta reste "Meta" explicite).
 */
export function chordFromEvent(e: KeyboardEvent, opts?: { mac?: boolean }): Chord | null {
  if (MODIFIER_KEY_NAMES.has(e.key)) return null;

  const mac = opts?.mac ?? isMac();
  const chord = emptyChord();

  if (mac) {
    if (e.metaKey) chord.mod = true;
    if (e.ctrlKey) chord.ctrl = true;
  } else {
    if (e.ctrlKey) chord.mod = true;
    if (e.metaKey) chord.meta = true;
  }
  if (e.altKey) chord.alt = true;
  if (e.shiftKey) chord.shift = true;
  chord.key = normalizeKey(e.key);

  return chord;
}

export function hasModifier(c: Chord): boolean {
  return c.mod || c.ctrl || c.meta || c.alt;
}

/** Un chord peut être assigné si : au moins un modificateur, OU touche nommée non-imprimable. */
export function isAssignable(chord: Chord): boolean {
  if (hasModifier(chord)) return true;
  return ALLOW_WITHOUT_MODIFIER.has(chord.key);
}

// ─── Parsing / sérialisation ──────────────────────────────────────────────────

/** Parse une chaîne canonique en Keybind. Retourne null si invalide. */
export function parseKeybind(str: string): Keybind | null {
  if (!str) return null;
  const chordStrings = str.trim().split(/\s+/);
  if (chordStrings.length === 0 || chordStrings.length > 2) return null;
  const chords: Chord[] = [];
  for (const cs of chordStrings) {
    const tokens = cs.split('+').map(t => t.trim()).filter(Boolean);
    if (tokens.length === 0) return null;
    const chord = emptyChord();
    for (let i = 0; i < tokens.length - 1; i++) {
      const tok = tokens[i].toLowerCase();
      switch (tok) {
        case 'mod':   chord.mod = true; break;
        case 'ctrl':
        case 'control': chord.ctrl = true; break;
        case 'meta':
        case 'cmd':
        case 'command': chord.meta = true; break;
        case 'alt':
        case 'option':  chord.alt = true; break;
        case 'shift':   chord.shift = true; break;
        default: return null;
      }
    }
    chord.key = normalizeKey(tokens[tokens.length - 1]);
    if (!chord.key) return null;
    chords.push(chord);
  }
  return chords;
}

/** Sérialise une Keybind en chaîne canonique. */
export function serializeKeybind(kb: Keybind): string {
  return kb.map(serializeChord).join(' ');
}

function serializeChord(c: Chord): string {
  const parts: string[] = [];
  if (c.mod) parts.push('Mod');
  if (c.ctrl) parts.push('Ctrl');
  if (c.meta) parts.push('Meta');
  if (c.alt) parts.push('Alt');
  if (c.shift) parts.push('Shift');
  parts.push(c.key);
  return parts.join('+');
}

// ─── Affichage humain ─────────────────────────────────────────────────────────

const MAC_SYMBOLS: Record<string, string> = {
  Mod: '\u2318',    // ⌘
  Meta: '\u2318',   // ⌘
  Ctrl: '\u2303',   // ⌃
  Alt: '\u2325',    // ⌥
  Shift: '\u21E7',  // ⇧
};

const KEY_DISPLAY: Record<string, string> = {
  ArrowLeft: '\u2190',
  ArrowRight: '\u2192',
  ArrowUp: '\u2191',
  ArrowDown: '\u2193',
  Enter: 'Enter',
  Escape: 'Esc',
  ' ': 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
};

function formatChord(c: Chord, mac: boolean): string {
  const parts: string[] = [];
  if (c.mod)   parts.push(mac ? MAC_SYMBOLS.Mod   : 'Ctrl');
  if (c.ctrl)  parts.push(mac ? MAC_SYMBOLS.Ctrl  : 'Ctrl');
  if (c.meta)  parts.push(mac ? MAC_SYMBOLS.Meta  : 'Meta');
  if (c.alt)   parts.push(mac ? MAC_SYMBOLS.Alt   : 'Alt');
  if (c.shift) parts.push(mac ? MAC_SYMBOLS.Shift : 'Shift');
  const keyLabel = KEY_DISPLAY[c.key] ?? c.key;
  parts.push(keyLabel);
  return mac ? parts.join('') : parts.join('+');
}

/** Formate une Keybind pour affichage à l'utilisateur (OS-aware). */
export function formatKeybind(kb: Keybind, opts?: { mac?: boolean }): string {
  const mac = opts?.mac ?? isMac();
  return kb.map(c => formatChord(c, mac)).join(' ');
}

// ─── Matching contre un KeyboardEvent ─────────────────────────────────────────

export function matchesChord(chord: Chord, e: KeyboardEvent, opts?: { mac?: boolean }): boolean {
  const mac = opts?.mac ?? isMac();

  // Mod = Cmd sur mac, Ctrl sur Win/Linux.
  const modPressed = mac ? e.metaKey : e.ctrlKey;
  // Modificateur "raw" (non-Mod) : sur mac, Ctrl est "raw"; sur Win/Linux, Meta est "raw".
  const rawCtrlPressed = mac ? e.ctrlKey : false;
  const rawMetaPressed = mac ? false : e.metaKey;

  if (chord.mod !== modPressed) return false;
  if (chord.ctrl !== rawCtrlPressed) return false;
  if (chord.meta !== rawMetaPressed) return false;
  if (chord.alt !== e.altKey) return false;
  if (chord.shift !== e.shiftKey) return false;
  return keysMatch(chord.key, e.key);
}

// ─── Touches réservées OS/navigateur ──────────────────────────────────────────

/** Combos qu'on refuse d'assigner (reload, devtools, etc.). Comparaison sur chaîne canonique. */
export const BLOCKED_KEYBINDS = new Set<string>([
  'Mod+R',
  'Mod+Shift+R',
  'F5',
  'F12',
  'Mod+Shift+I',
  'Mod+Shift+J',
  'Mod+Shift+C',
  'Mod+Q',
  'Alt+F4',
]);

export function isBlocked(kb: Keybind): boolean {
  // Seul le 1ᵉʳ chord d'une séquence peut entrer en conflit avec un raccourci OS.
  const first = kb[0];
  if (!first) return false;
  return BLOCKED_KEYBINDS.has(serializeChord(first));
}

// ─── Matcher global avec support chord-sequences ──────────────────────────────

export type KeybindRegistration = {
  id: string;
  keybind: Keybind;
  handler: (e: KeyboardEvent) => void;
};

const CHORD_TIMEOUT_MS = 1500;

/**
 * Crée un matcher `keydown` qui gère combos simples et séquences à deux chords.
 * `getBindings` est rappelée à chaque événement pour refléter les changements de config.
 */
export function createKeybindMatcher(
  getBindings: () => KeybindRegistration[],
  opts?: { mac?: boolean; timeoutMs?: number }
): (e: KeyboardEvent) => void {
  const mac = opts?.mac;
  const timeoutMs = opts?.timeoutMs ?? CHORD_TIMEOUT_MS;

  let pendingFirstChord: Chord | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  function clearPending() {
    pendingFirstChord = null;
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  return (e: KeyboardEvent) => {
    if (MODIFIER_KEY_NAMES.has(e.key)) return;

    const bindings = getBindings();

    if (pendingFirstChord) {
      // Phase 2 d'une séquence : cherche un binding dont le 1ᵉʳ chord == pendingFirstChord et le 2ᵉ match e.
      const matches = bindings.filter(
        b => b.keybind.length === 2 && chordsEqual(b.keybind[0], pendingFirstChord!) &&
             matchesChord(b.keybind[1], e, { mac: mac ?? isMac() })
      );
      clearPending();
      if (matches.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        matches[0].handler(e);
        return;
      }
      // Pas de match : on abandonne la séquence (l'événement courant n'est pas consommé).
      return;
    }

    // Phase 1 : cherche un binding simple qui matche directement.
    const directMatch = bindings.find(
      b => b.keybind.length === 1 && matchesChord(b.keybind[0], e, { mac: mac ?? isMac() })
    );
    if (directMatch) {
      e.preventDefault();
      e.stopPropagation();
      directMatch.handler(e);
      return;
    }

    // Phase 1 : entre-t-on dans une séquence ?
    const startsSequence = bindings.some(
      b => b.keybind.length === 2 && matchesChord(b.keybind[0], e, { mac: mac ?? isMac() })
    );
    if (startsSequence) {
      e.preventDefault();
      e.stopPropagation();
      // On capture le chord normalisé pour comparaison (via chordFromEvent).
      pendingFirstChord = chordFromEvent(e, { mac: mac ?? isMac() });
      pendingTimer = setTimeout(clearPending, timeoutMs);
    }
  };
}

function chordsEqual(a: Chord, b: Chord): boolean {
  return a.mod === b.mod && a.ctrl === b.ctrl && a.meta === b.meta &&
         a.alt === b.alt && a.shift === b.shift &&
         normalizeKey(a.key) === normalizeKey(b.key);
}

// ─── Migration de l'ancien format "simple key string" ─────────────────────────

/**
 * Migre une ancienne valeur (ex. "s", "B", "\\") vers le nouveau format canonique.
 * `defaultKb` est utilisée si `legacy` est déjà valide, ou si elle n'est pas migrable.
 */
export function migrateLegacyKeybind(legacy: unknown, defaultKb: string): string {
  if (typeof legacy !== 'string' || legacy.length === 0) return defaultKb;

  // Déjà au nouveau format ? (contient '+' ou espace, et parse ok)
  if ((legacy.includes('+') || legacy.includes(' ')) && parseKeybind(legacy)) {
    return legacy;
  }

  // Ancien format : un seul caractère ou une touche nommée courte. On préfixe par "Mod+".
  // Les lettres sont mises en majuscule pour la cohérence.
  const normalized = normalizeKey(legacy);
  return `Mod+${normalized}`;
}
