const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Sanitized API HTML (section and about-item bodies, C26) → one line of plain text, for slots that
 * take text (card leads, section leads). Tags become spaces, entities are decoded (Angular
 * interpolation would otherwise show `&amp;` literally), whitespace collapses. Pure string work, so
 * it behaves the same during SSR. Returns null when nothing is left.
 */
export function plainText(html: string | null | undefined): string | null {
  if (!html) {
    return null;
  }
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] !== '#') {
        return NAMED[code.toLowerCase()] ?? entity;
      }
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}
