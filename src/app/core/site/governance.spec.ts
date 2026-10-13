import type { DocSection } from '../api/models';
import { governanceLinks, legacyDocumentsPath, licenceStatus, riyadhToday } from './governance';

const section = (
  slug: string,
  sectionGroup: 'governance' | 'other' = 'governance',
): DocSection => ({
  id: slug,
  slug,
  name: `[${slug}]`,
  sectionGroup,
  count: 0,
});

describe('governance helpers', () => {
  it('builds the menu from the API sections (governance group only), then licences and board', () => {
    const links = governanceLinks([
      section('bylaws-policies'),
      section('other-docs', 'other'),
      section('financial-reports'),
    ]);
    expect(links.map((l) => [l.key, l.path])).toEqual([
      ['bylaws-policies', '/governance/bylaws-policies'],
      ['financial-reports', '/governance/financial-reports'],
      ['licences', '/governance/licences'],
      ['board', '/board'],
    ]);
    expect(links[0].label).toBe('[bylaws-policies]');
    expect(links[2].labelKey).toBe('pages.governance.licences');
    expect(governanceLinks([], { board: false }).map((l) => l.key)).toEqual(['licences']);
  });

  it('maps old /documents?category= links to the governance pages', () => {
    expect(legacyDocumentsPath(null)).toBe('/governance');
    expect(legacyDocumentsPath('policies-regulations')).toBe('/governance/bylaws-policies');
    expect(legacyDocumentsPath('meeting-minutes')).toBe('/governance/general-assembly');
    expect(legacyDocumentsPath('annual-reports')).toBe('/governance/annual-reports');
    expect(legacyDocumentsPath('licences')).toBe('/governance/licences');
    expect(legacyDocumentsPath('financial-reports')).toBe('/governance/financial-reports');
    expect(legacyDocumentsPath('Bad Slug/../x')).toBe('/governance');
  });

  it('a licence is valid through its expiry day, expired after it, unknown without one', () => {
    expect(licenceStatus('2026-10-13', '2026-10-13')).toBe('valid');
    expect(licenceStatus('2026-10-12', '2026-10-13')).toBe('expired');
    expect(licenceStatus('2030-01-01T00:00:00.000Z', '2026-10-13')).toBe('valid');
    expect(licenceStatus(null, '2026-10-13')).toBeNull();
  });

  it('today is the calendar date in Riyadh (UTC+3)', () => {
    expect(riyadhToday(new Date('2026-10-12T21:30:00Z'))).toBe('2026-10-13');
    expect(riyadhToday(new Date('2026-10-12T20:30:00Z'))).toBe('2026-10-12');
  });
});
