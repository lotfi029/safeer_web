#!/usr/bin/env node
/**
 * Brand assets from the association's official logo file (docs/brand/safeer-logo-official.svg, the
 * full lockup on a 2000×2000 canvas: the mark on top, the calligraphic wordmark under it).
 *
 * Nothing is traced or redrawn: the outputs are the official paths, only cropped and re-coloured
 * inline. The file's <style> classes become `fill` attributes, so the SVG needs no stylesheet and can't
 * be affected by a style CSP.
 *
 *   public/brand/safeer-mark.svg     the mark alone, cropped to its bounds (<app-logo>, intro)
 *   public/brand/safeer-lockup.svg   mark + wordmark, cropped (available for print/footer use)
 *   public/brand/safeer-logo.png     the mark, 512 px tall, on transparent (JSON-LD `logo`)
 *   public/favicon.ico               16/32/48 px, the mark on white, PNG-in-ICO
 *   public/brand/apple-touch-icon.png  180×180, the mark on white
 *
 * Usage: node scripts/build-brand.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SOURCE = 'docs/brand/safeer-logo-official.svg';
const OUT = 'public/brand';
const PAD = 12; // viewBox units around the cropped artwork

/** `.cls-N { fill: #hex; }` → { 'cls-N': '#hex' } */
export function classFills(svg) {
  const fills = {};
  for (const [, name, color] of svg.matchAll(
    /\.(cls-\d+)\s*\{\s*fill:\s*(#[0-9a-fA-F]{3,8})\s*;?\s*\}/g,
  )) {
    fills[name] = color;
  }
  return fills;
}

/** Drops <defs><style>, ids and data-names; turns `class="cls-N"` into `fill="#…"`. */
export function inlineFills(svg) {
  const fills = classFills(svg);
  return svg
    .replace(/<\?xml[^>]*\?>\s*/, '')
    .replace(/<defs>[\s\S]*?<\/defs>\s*/, '')
    .replace(/\s(?:id|data-name)="[^"]*"/g, '')
    .replace(/class="(cls-\d+)"/g, (whole, name) =>
      fills[name] ? `fill="${fills[name]}"` : whole,
    );
}

/** The top-level children of the root <svg> (depth-aware on <g>). */
export function topLevelChildren(svg) {
  const body = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'));
  const parts = [];
  let depth = 0;
  let start = -1;
  const tag = /<(\/?)(g|path|rect|circle)\b[^>]*?(\/?)>/g;
  for (const m of body.matchAll(tag)) {
    const [whole, closing, name, selfClosing] = m;
    if (name === 'g' && !closing && !selfClosing) {
      if (depth === 0) start = m.index;
      depth++;
    } else if (name === 'g' && closing) {
      depth--;
      if (depth === 0) parts.push(body.slice(start, m.index + whole.length));
    } else if (depth === 0) {
      parts.push(whole);
    }
  }
  return parts;
}

function wrap(content, viewBox) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>\n`;
}

/** Bounds of the painted pixels, in viewBox units (the source canvas is 2000 units = 2000 px at 72 dpi). */
async function bounds(svgText) {
  const { info } = await sharp(Buffer.from(svgText), { density: 72 })
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  const left = -info.trimOffsetLeft;
  const top = -info.trimOffsetTop;
  return { left, top, width: info.width, height: info.height };
}

async function cropped(content) {
  const full = wrap(content, '0 0 2000 2000');
  const b = await bounds(full);
  const viewBox = [b.left - PAD, b.top - PAD, b.width + 2 * PAD, b.height + 2 * PAD].join(' ');
  return { svg: wrap(content, viewBox), width: b.width + 2 * PAD, height: b.height + 2 * PAD };
}

/** A PNG-in-ICO container (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function squareOnWhite(svg, size, inset) {
  const inner = Math.round(size * (1 - 2 * inset));
  const mark = await sharp(Buffer.from(svg), { density: 600 })
    .resize({ width: inner, height: inner, fit: 'contain', background: '#ffffff00' })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const source = inlineFills(readFileSync(SOURCE, 'utf8'));
  const [wordmark, ...markParts] = topLevelChildren(source);
  const mark = await cropped(markParts.join(''));
  const lockup = await cropped([wordmark, ...markParts].join(''));

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/safeer-mark.svg`, mark.svg);
  writeFileSync(`${OUT}/safeer-lockup.svg`, lockup.svg);
  await sharp(Buffer.from(mark.svg), { density: 300 })
    .resize({ height: 512 })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/safeer-logo.png`);
  await sharp(await squareOnWhite(mark.svg, 180, 0.1)).toFile(`${OUT}/apple-touch-icon.png`);
  const icons = [];
  for (const size of [16, 32, 48]) {
    icons.push({ size, data: await squareOnWhite(mark.svg, size, 0.04) });
  }
  writeFileSync('public/favicon.ico', ico(icons));

  console.log(
    `mark ${Math.round(mark.width)}×${Math.round(mark.height)} units, lockup ${Math.round(lockup.width)}×${Math.round(lockup.height)} units`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
