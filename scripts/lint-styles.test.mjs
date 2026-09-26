import { describe, expect, it } from 'vitest';
import { lintSource } from './lint-styles.mjs';

describe('lint-styles (R9)', () => {
  it('flags physical Tailwind utilities in class contexts', () => {
    const problems = lintSource('src/a.html', '<div class="ml-4 pe-2 text-right -mr-1"></div>');
    expect(problems.map((p) => p.message).join()).toMatch(/ml-4/);
    expect(problems.map((p) => p.message).join()).toMatch(/text-right/);
    expect(problems.map((p) => p.message).join()).toMatch(/-mr-1/);
    expect(problems.some((p) => p.message.includes('pe-2'))).toBe(false);
  });

  it('allows logical utilities', () => {
    expect(
      lintSource('src/a.html', '<div class="ms-4 pe-2 text-start start-0 rounded-s-lg"></div>'),
    ).toEqual([]);
  });

  it('flags physical CSS properties', () => {
    const css = '.a { margin-left: 1px; } .b { left: 0; } .c { text-align: right; }';
    expect(lintSource('src/a.css', css)).toHaveLength(3);
    expect(
      lintSource('src/a.css', '.a { margin-inline-start: 1px; inset-inline-start: 0; }'),
    ).toEqual([]);
  });

  it('allows hex only in tokens.css', () => {
    expect(lintSource('src/styles/tokens.css', ':root { --x: #0b4343; }')).toEqual([]);
    expect(lintSource('src/a.css', '.a { color: #0b4343; }')).toHaveLength(1);
    expect(lintSource('src/a.ts', "const c = '#fff';")).toHaveLength(1);
    expect(lintSource('src/a.html', '<p class="bg-[#fff]"></p>')).toHaveLength(1);
  });

  it('ignores template refs and private fields that look like hex', () => {
    expect(
      lintSource('src/a.html', '<input #add /><button (click)="add.focus()"></button>'),
    ).toEqual([]);
    expect(lintSource('src/a.ts', 'class A { #bad = 1; }')).toEqual([]);
  });
});
