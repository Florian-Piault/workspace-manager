import { describe, it, expect } from 'vitest';
import { detectLanguage } from './language-detect';

describe('detectLanguage', () => {
  it('détecte TypeScript depuis .ts', () => {
    expect(detectLanguage('/project/src/main.ts')).toBe('typescript');
  });

  it('détecte TypeScript depuis .tsx', () => {
    expect(detectLanguage('/project/src/App.tsx')).toBe('typescript');
  });

  it('détecte JavaScript depuis .js', () => {
    expect(detectLanguage('/project/index.js')).toBe('javascript');
  });

  it('détecte JavaScript depuis .jsx', () => {
    expect(detectLanguage('/project/App.jsx')).toBe('javascript');
  });

  it('détecte Rust depuis .rs', () => {
    expect(detectLanguage('/project/src/main.rs')).toBe('rust');
  });

  it('détecte JSON depuis .json', () => {
    expect(detectLanguage('/project/package.json')).toBe('json');
  });

  it('détecte Markdown depuis .md', () => {
    expect(detectLanguage('/project/README.md')).toBe('markdown');
  });

  it('détecte Markdown depuis .mdx', () => {
    expect(detectLanguage('/project/docs/page.mdx')).toBe('markdown');
  });

  it('retourne text pour une extension inconnue', () => {
    expect(detectLanguage('/project/file.xyz')).toBe('text');
  });

  it('retourne text pour null', () => {
    expect(detectLanguage(null)).toBe('text');
  });

  it("est insensible à la casse de l'extension", () => {
    expect(detectLanguage('/project/file.TS')).toBe('typescript');
  });
});
