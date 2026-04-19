import Database from '@tauri-apps/plugin-sql';
import { migrateLegacyKeybind } from './utils/keybind';

/**
 * Valeurs sous forme de chaîne canonique (ex. "Mod+S", "Mod+Shift+B",
 * "Mod+K Mod+S"). Voir `src/lib/utils/keybind.ts`.
 */
export interface KeybindSettings {
  splitHorizontal: string;
  splitVertical: string;
  closePanel: string;
  toggleSidebar: string;
  saveFile: string;
  toggleFileTree: string;
  quickSwitch: string;
}

export interface EditorDefaults {
  lineNumbers: boolean;
  wordWrap: boolean;
  highlightActiveLine: boolean;
  fontSize: number;
  readOnly: boolean;
  indentUnit: 2 | 4 | 8;
  autocompletion: boolean;
  lint: boolean;
  editorTheme: 'oneDark' | 'default';
  autoSaveDelay: number;
  showHiddenFiles: boolean;
  excludePatterns: string[];
}

export interface TerminalSettings {
  fontSize: number;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'bar' | 'underline';
  colorPreset: 'dark' | 'solarizedDark' | 'light';
  shell: string;
  shellArgs: string;
}

export interface BrowserSettings {
  defaultUrl: string;
}

export interface GeneralSettings {
  reopenLastWorkspace: boolean;
  confirmCloseWorkspace: boolean;
  sidebarPosition: 'left' | 'right';
}

export type TerminalColorPreset = TerminalSettings['colorPreset'];

export const TERMINAL_COLOR_PRESETS: Record<
  TerminalColorPreset,
  { background: string; foreground: string; cursor: string; selectionBackground: string }
> = {
  dark: { background: '#0f0f0f', foreground: '#d4d4d4', cursor: '#d4d4d4', selectionBackground: '#3a3a3a' },
  solarizedDark: { background: '#002b36', foreground: '#839496', cursor: '#839496', selectionBackground: '#073642' },
  light: { background: '#fafafa', foreground: '#383a42', cursor: '#383a42', selectionBackground: '#d0d0d0' },
};

const EDITOR_DEFAULTS: EditorDefaults = {
  lineNumbers: true,
  wordWrap: false,
  highlightActiveLine: true,
  fontSize: 13,
  readOnly: false,
  indentUnit: 2,
  autocompletion: true,
  lint: false,
  editorTheme: 'oneDark',
  autoSaveDelay: 1000,
  showHiddenFiles: false,
  excludePatterns: ['node_modules', '.git', 'target', 'dist'],
};

const TERMINAL_DEFAULTS: TerminalSettings = {
  fontSize: 13,
  cursorBlink: true,
  cursorStyle: 'block',
  colorPreset: 'dark',
  shell: '',
  shellArgs: '',
};

const BROWSER_DEFAULTS: BrowserSettings = {
  defaultUrl: 'https://after-glow.fr',
};

const GENERAL_DEFAULTS: GeneralSettings = {
  reopenLastWorkspace: false,
  confirmCloseWorkspace: false,
  sidebarPosition: 'left',
};

export const KEYBIND_DEFAULTS: KeybindSettings = {
  splitHorizontal: 'Mod+\\',
  splitVertical:   'Mod+-',
  closePanel:      'Mod+W',
  toggleSidebar:   'Mod+B',
  saveFile:        'Mod+S',
  toggleFileTree:  'Mod+Shift+B',
  quickSwitch:     'Mod+P',
};

function createSettingsStore() {
  let db: Database | null = null;
  let editor = $state<EditorDefaults>({ ...EDITOR_DEFAULTS });
  let terminal = $state<TerminalSettings>({ ...TERMINAL_DEFAULTS });
  let browser = $state<BrowserSettings>({ ...BROWSER_DEFAULTS });
  let general = $state<GeneralSettings>({ ...GENERAL_DEFAULTS });
  let keybinds = $state<KeybindSettings>({ ...KEYBIND_DEFAULTS });
  let ready = $state(false);

  async function init() {
    db = await Database.load('sqlite:workspace.db');
    const rows = await db.select<Array<{ key: string; value: string }>>(
      'SELECT key, value FROM settings'
    );
    let keybindsMigrated = false;
    for (const { key, value } of rows) {
      try {
        const parsed = JSON.parse(value);
        if (key === 'editor') editor = { ...EDITOR_DEFAULTS, ...parsed };
        else if (key === 'terminal') terminal = { ...TERMINAL_DEFAULTS, ...parsed };
        else if (key === 'browser') browser = { ...BROWSER_DEFAULTS, ...parsed };
        else if (key === 'general') general = { ...GENERAL_DEFAULTS, ...parsed };
        else if (key === 'keybinds') {
          const { migrated, didMigrate } = migrateKeybindsRecord(parsed);
          keybinds = { ...KEYBIND_DEFAULTS, ...migrated };
          keybindsMigrated = didMigrate;
        }
      } catch {
        // keep defaults on malformed JSON
      }
    }
    if (keybindsMigrated) {
      // Persiste la version migrée pour éviter de remigrer à chaque lancement.
      await persist('keybinds', keybinds);
    }
    ready = true;
  }

  /**
   * Migre les valeurs de l'ancien format "single key" vers le format canonique.
   * Cas spécial `toggleFileTree` : l'ancien code ajoutait Shift en dur ; on le préserve.
   */
  function migrateKeybindsRecord(parsed: unknown): { migrated: Partial<KeybindSettings>; didMigrate: boolean } {
    if (!parsed || typeof parsed !== 'object') return { migrated: {}, didMigrate: false };
    const src = parsed as Record<string, unknown>;
    const out: Partial<KeybindSettings> = {};
    let didMigrate = false;
    for (const key of Object.keys(KEYBIND_DEFAULTS) as (keyof KeybindSettings)[]) {
      const raw = src[key];
      if (raw == null) continue;
      const defaultCombo = KEYBIND_DEFAULTS[key];
      if (typeof raw === 'string') {
        const isLegacy = !(raw.includes('+') || raw.includes(' '));
        if (isLegacy) {
          // `toggleFileTree` avait un Shift hardcodé dans l'ancien code.
          if (key === 'toggleFileTree') {
            const upper = raw.length === 1 ? raw.toUpperCase() : raw;
            out[key] = `Mod+Shift+${upper}`;
          } else {
            out[key] = migrateLegacyKeybind(raw, defaultCombo);
          }
          didMigrate = true;
        } else {
          out[key] = raw;
        }
      }
    }
    return { migrated: out, didMigrate };
  }

  async function persist(key: string, value: unknown) {
    await db!.execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, JSON.stringify(value)]
    );
  }

  async function setEditor(patch: Partial<EditorDefaults>) {
    editor = { ...editor, ...patch };
    await persist('editor', editor);
  }

  async function setTerminal(patch: Partial<TerminalSettings>) {
    terminal = { ...terminal, ...patch };
    await persist('terminal', terminal);
  }

  async function setBrowser(patch: Partial<BrowserSettings>) {
    browser = { ...browser, ...patch };
    await persist('browser', browser);
  }

  async function setGeneral(patch: Partial<GeneralSettings>) {
    general = { ...general, ...patch };
    await persist('general', general);
  }

  async function setKeybinds(patch: Partial<KeybindSettings>) {
    keybinds = { ...keybinds, ...patch };
    await persist('keybinds', keybinds);
  }

  async function resetKeybinds() {
    keybinds = { ...KEYBIND_DEFAULTS };
    await persist('keybinds', keybinds);
  }

  return {
    get editor() { return editor; },
    get terminal() { return terminal; },
    get browser() { return browser; },
    get general() { return general; },
    get keybinds() { return keybinds; },
    get ready() { return ready; },
    init,
    setEditor,
    setTerminal,
    setBrowser,
    setGeneral,
    setKeybinds,
    resetKeybinds,
  };
}

export const settings = createSettingsStore();
