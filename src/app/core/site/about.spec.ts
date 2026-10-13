import { aboutLinks } from './about';
import { GOVERNANCE_PATHS } from './governance';

describe('aboutLinks', () => {
  it('lists the about page, the org structure and the licences, as on ta3lom', () => {
    const links = aboutLinks();
    expect(links.map((l) => l.key)).toEqual(['about', 'org-structure', 'licences']);
    expect(links.find((l) => l.key === 'licences')?.path).toBe(GOVERNANCE_PATHS.licences);
    // Only the about page needs an exact match (it is a prefix of the org structure page).
    expect(links.filter((l) => l.exact).map((l) => l.key)).toEqual(['about']);
  });
});
