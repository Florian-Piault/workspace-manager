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

function createSettingsStore() {
  let db: Database | null = null;
  let editor = $state<EditorDefaults>({ ...EDITOR_DEFAULTS });
  let ready = $state(false);

  async function init() {
    db = await Database.load('sqlite:workspace.db');
    const rows = await db.select<Array<{ key: string; value: string }>>(
      'SELECT key, value FROM settings'
    );
    for (const { key, value } of rows) {
      if (key === 'editor') {
        try {
          editor = { ...EDITOR_DEFAULTS, ...JSON.parse(value) };
        } catch {
          // keep defaults on malformed JSON
        }
      }
    }
    ready = true;
  }

  async function setEditor(patch: Partial<EditorDefaults>) {
    editor = { ...editor, ...patch };
    await db!.execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['editor', JSON.stringify(editor)]
    );
  }

  return {
    get editor() { return editor; },
    get ready() { return ready; },
    init,
    setEditor,
  };
}

export const settings = createSettingsStore();
