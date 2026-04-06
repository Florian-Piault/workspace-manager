const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  rs: 'rust',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
};

export function detectLanguage(filePath: string | null): string {
  if (!filePath) return 'text';
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MAP[ext] ?? 'text';
}
