import Database from '@tauri-apps/plugin-sql';

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
}

export interface TerminalSettings {
  fontSize: number;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'bar' | 'underline';
  colorPreset: 'dark' | 'solarizedDark' | 'light';
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
};

const TERMINAL_DEFAULTS: TerminalSettings = {
  fontSize: 13,
  cursorBlink: true,
  cursorStyle: 'block',
  colorPreset: 'dark',
};

const BROWSER_DEFAULTS: BrowserSettings = {
  defaultUrl: 'https://after-glow.fr',
};

const GENERAL_DEFAULTS: GeneralSettings = {
  reopenLastWorkspace: false,
  confirmCloseWorkspace: false,
  sidebarPosition: 'left',
};

function createSettingsStore() {
  let db: Database | null = null;
  let editor = $state<EditorDefaults>({ ...EDITOR_DEFAULTS });
  let terminal = $state<TerminalSettings>({ ...TERMINAL_DEFAULTS });
  let browser = $state<BrowserSettings>({ ...BROWSER_DEFAULTS });
  let general = $state<GeneralSettings>({ ...GENERAL_DEFAULTS });
  let ready = $state(false);

  async function init() {
    db = await Database.load('sqlite:workspace.db');
    const rows = await db.select<Array<{ key: string; value: string }>>(
      'SELECT key, value FROM settings'
    );
    for (const { key, value } of rows) {
      try {
        const parsed = JSON.parse(value);
        if (key === 'editor') editor = { ...EDITOR_DEFAULTS, ...parsed };
        else if (key === 'terminal') terminal = { ...TERMINAL_DEFAULTS, ...parsed };
        else if (key === 'browser') browser = { ...BROWSER_DEFAULTS, ...parsed };
        else if (key === 'general') general = { ...GENERAL_DEFAULTS, ...parsed };
      } catch {
        // keep defaults on malformed JSON
      }
    }
    ready = true;
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

  return {
    get editor() { return editor; },
    get terminal() { return terminal; },
    get browser() { return browser; },
    get general() { return general; },
    get ready() { return ready; },
    init,
    setEditor,
    setTerminal,
    setBrowser,
    setGeneral,
  };
}

export const settings = createSettingsStore();
