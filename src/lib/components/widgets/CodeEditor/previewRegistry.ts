import type { Component } from 'svelte';
import MarkdownPreview from './previewers/MarkdownPreview.svelte';
import ImagePreview from './previewers/ImagePreview.svelte';
import JsonPreview from './previewers/JsonPreview.svelte';
import CsvPreview from './previewers/CsvPreview.svelte';
import HtmlPreview from './previewers/HtmlPreview.svelte';

export type PreviewProps = { content: string; filePath: string | null };
export type PreviewComponentType = Component<PreviewProps>;

export const previewRegistry: Record<string, PreviewComponentType> = {
  md:       MarkdownPreview as PreviewComponentType,
  markdown: MarkdownPreview as PreviewComponentType,
  svg:      ImagePreview    as PreviewComponentType,
  png:      ImagePreview    as PreviewComponentType,
  jpg:      ImagePreview    as PreviewComponentType,
  jpeg:     ImagePreview    as PreviewComponentType,
  webp:     ImagePreview    as PreviewComponentType,
  json:     JsonPreview     as PreviewComponentType,
  csv:      CsvPreview      as PreviewComponentType,
  html:     HtmlPreview     as PreviewComponentType,
};
