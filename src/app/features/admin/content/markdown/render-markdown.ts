import { Marked } from 'marked';

/**
 * The editor preview, rendered the way the API renders stored Markdown (safeer_api
 * common/markdown/markdown.service.ts): marked with GFM, headings clamped to h2–h4, then an
 * allow-list of tags and attributes (D-08). The result still goes through Angular's sanitizer in
 * `app-rich-text`.
 */
export const ALLOWED_TAGS = new Set([
  'H2',
  'H3',
  'H4',
  'STRONG',
  'B',
  'EM',
  'I',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'A',
  'CODE',
  'PRE',
  'P',
  'BR',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
]);
const ALLOWED_ATTR = new Set(['href', 'align']);

const md = new Marked({ gfm: true });
md.use({
  walkTokens(token) {
    if (token.type === 'heading') token.depth = Math.min(4, Math.max(2, token.depth));
  },
});

function clean(node: Node, doc: Document): void {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 1) {
      const el = child as Element;
      clean(el, doc);
      if (!ALLOWED_TAGS.has(el.tagName)) {
        // Unknown or dangerous element: keep its text, drop the element (scripts/styles entirely).
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE'].includes(el.tagName)) {
          el.remove();
        } else {
          el.replaceWith(...el.childNodes);
        }
        continue;
      }
      for (const attr of [...el.attributes]) {
        const bad =
          !ALLOWED_ATTR.has(attr.name) ||
          (attr.name === 'href' && /^\s*(javascript|data|vbscript):/i.test(attr.value));
        if (bad) el.removeAttribute(attr.name);
      }
      if (el.tagName === 'A') el.setAttribute('rel', 'noopener noreferrer');
    } else if (child.nodeType !== 3) {
      child.remove();
    }
  }
}

/** Markdown → HTML limited to the API's allow-list. Needs a DOM (browser/jsdom). */
export function renderMarkdown(
  markdown: string | null | undefined,
  doc: Document = document,
): string {
  if (!markdown) return '';
  const raw = md.parse(markdown, { async: false }) as string;
  const template = doc.createElement('template');
  template.innerHTML = raw;
  clean(template.content, doc);
  const box = doc.createElement('div');
  box.appendChild(template.content.cloneNode(true));
  return box.innerHTML;
}
