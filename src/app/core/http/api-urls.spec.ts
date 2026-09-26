import { apiArea, apiPath } from './api-urls';

describe('api-urls', () => {
  it('extracts the path after /api/v1 for relative and absolute URLs', () => {
    expect(apiPath('/api/v1/portal/me')).toBe('/portal/me');
    expect(apiPath('http://127.0.0.1:3000/api/v1/news?page=2')).toBe('/news');
    expect(apiPath('/api/v1')).toBe('/');
    expect(apiPath('/api/v10/x')).toBeNull();
    expect(apiPath('/files/abc')).toBeNull();
  });

  it('classifies areas', () => {
    expect(apiArea('/api/v1/admin/me')).toBe('admin');
    expect(apiArea('/api/v1/administration')).toBe('public');
    expect(apiArea('/api/v1/portal/documents/1')).toBe('portal');
    expect(apiArea('/api/v1/applications')).toBe('applications');
    expect(apiArea('/api/v1/home')).toBe('public');
    expect(apiArea('/assets/x')).toBeNull();
  });
});
