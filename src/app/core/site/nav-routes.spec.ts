import { appPathForApiUrl, navLabel, pathForNavSlug } from './nav-routes';

describe('nav routes', () => {
  it('maps API nav slugs to app paths', () => {
    expect(pathForNavSlug('work')).toBe('/work-areas');
    expect(pathForNavSlug('home')).toBe('/');
    expect(pathForNavSlug('unknown')).toBeNull();
  });

  it('maps API button URLs (B9 paths, legacy hash routes, external) safely', () => {
    expect(appPathForApiUrl('/contact')).toEqual({ internal: '/contact' });
    expect(appPathForApiUrl('#/work')).toEqual({ internal: '/work-areas' });
    expect(appPathForApiUrl('#/contact')).toEqual({ internal: '/contact' });
    expect(pathForNavSlug('governance')).toBe('/governance');
    expect(appPathForApiUrl('https://example.org/x')).toEqual({
      external: 'https://example.org/x',
    });
    expect(appPathForApiUrl('javascript:alert(1)')).toBeNull();
    expect(appPathForApiUrl('//evil.example')).toBeNull();
    expect(appPathForApiUrl(null)).toBeNull();
  });
});

describe('navLabel (W5)', () => {
  it('uses the short prototype label for header slugs in both languages', () => {
    expect(navLabel('governance', 'en', 'Governance and transparency')).toBe('Governance');
    expect(navLabel('governance', 'ar', 'الحوكمة والشفافية')).toBe('الحوكمة');
  });

  it('falls back to the API title for slugs without a short label', () => {
    expect(navLabel('testimonials', 'en', 'What our students say')).toBe('What our students say');
  });
});
