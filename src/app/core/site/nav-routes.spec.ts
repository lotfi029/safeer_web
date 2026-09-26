import { appPathForApiUrl, pathForNavSlug } from './nav-routes';

describe('nav routes', () => {
  it('maps API nav slugs to app paths', () => {
    expect(pathForNavSlug('work')).toBe('/work-areas');
    expect(pathForNavSlug('home')).toBe('/');
    expect(pathForNavSlug('unknown')).toBeNull();
  });

  it('maps API button URLs (B9 paths, legacy hash routes, external) safely', () => {
    expect(appPathForApiUrl('/apply')).toEqual({ internal: '/apply' });
    expect(appPathForApiUrl('#/work')).toEqual({ internal: '/work-areas' });
    expect(appPathForApiUrl('#/apply')).toEqual({ internal: '/apply' });
    expect(appPathForApiUrl('https://example.org/x')).toEqual({
      external: 'https://example.org/x',
    });
    expect(appPathForApiUrl('javascript:alert(1)')).toBeNull();
    expect(appPathForApiUrl('//evil.example')).toBeNull();
    expect(appPathForApiUrl(null)).toBeNull();
  });
});
