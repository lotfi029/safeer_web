import { describe, expect, it } from 'vitest';
import { collapseBilingual } from '../mocks/collapse.mjs';
import { mergeBilingual } from './record-fixtures.mjs';

describe('record-fixtures mergeBilingual (W1/W24)', () => {
  const ar = {
    board: [
      { id: '1', name: 'د. أ', role: 'رئيس المجلس', isLead: true, bio: null, photoAsset: null },
    ],
    executive: [],
    slug: 'board',
  };
  const en = {
    board: [
      { id: '1', name: 'Dr. A', role: 'Chairman', isLead: true, bio: null, photoAsset: null },
    ],
    executive: [],
    slug: 'board',
  };

  it('turns strings that differ into xAr/xEn pairs and keeps the rest', () => {
    expect(mergeBilingual(ar, en)).toEqual({
      board: [
        {
          id: '1',
          nameAr: 'د. أ',
          nameEn: 'Dr. A',
          roleAr: 'رئيس المجلس',
          roleEn: 'Chairman',
          isLead: true,
          bio: null,
          photoAsset: null,
        },
      ],
      executive: [],
      slug: 'board',
    });
  });

  it('is the inverse of the mock collapse in both languages', () => {
    const merged = mergeBilingual(ar, en);
    expect(collapseBilingual(merged, 'ar')).toEqual(ar);
    expect(collapseBilingual(merged, 'en')).toEqual(en);
  });

  it('refuses responses whose shapes differ between languages', () => {
    expect(() => mergeBilingual({ list: [1] }, { list: [] })).toThrow(/\$\.list/);
  });
});
