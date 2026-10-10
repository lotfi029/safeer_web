import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classFills, inlineFills, topLevelChildren } from './build-brand.mjs';

const official = readFileSync('docs/brand/safeer-logo-official.svg', 'utf8');

describe('build-brand (official logo → app assets)', () => {
  it('reads every class colour from the file', () => {
    const fills = classFills(official);
    expect(Object.keys(fills)).toHaveLength(9);
    expect(fills['cls-3']).toBe('#518f90');
  });

  it('inlines the fills: no <style>, no classes, no ids left', () => {
    const svg = inlineFills(official);
    expect(svg).not.toMatch(/<style|class=|\sid=|data-name/);
    expect(svg).toContain('fill="#2d4f50"');
  });

  it('splits the lockup into the wordmark group first, then the mark', () => {
    const [wordmark, ...mark] = topLevelChildren(inlineFills(official));
    expect(wordmark.startsWith('<g>')).toBe(true);
    expect(wordmark).toContain('fill="#3f4b5a"');
    expect(mark.join('')).toContain('<circle');
    expect(mark.join('')).not.toContain('#3f4b5a');
  });

  it('the committed mark is the cropped official artwork', () => {
    const mark = readFileSync('public/brand/safeer-mark.svg', 'utf8');
    expect(mark).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d. -]+">/);
    expect(mark).not.toMatch(/<style|class=/);
  });
});
