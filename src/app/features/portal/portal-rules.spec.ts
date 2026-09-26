import type { ApplicantDocument } from '../../core/api/models';
import { canUpload, type PortalDocRow } from './portal-documents';
import { safePortalReturn } from './portal-login';

function row(
  status: ApplicantDocument['status'] | null,
  docType: PortalDocRow['docType'] = 'id_copy',
): PortalDocRow {
  return {
    key: 'k',
    docType,
    doc: status ? ({ id: '1', docType, status } as ApplicantDocument) : null,
  };
}

describe('canUpload (B3 upload rules)', () => {
  it('never replaces an accepted document', () => {
    expect(canUpload('draft', row('accepted'), [])).toBe(false);
    expect(canUpload('docs_missing', row('accepted'), ['id_copy'])).toBe(false);
  });

  it('allows anything else while the application is a draft', () => {
    expect(canUpload('draft', row(null), [])).toBe(true);
    expect(canUpload('draft', row('under_review'), [])).toBe(true);
  });

  it('in docs_missing allows rejected documents and requested types only', () => {
    expect(canUpload('docs_missing', row('rejected'), [])).toBe(true);
    expect(canUpload('docs_missing', row(null, 'certificate'), ['certificate'])).toBe(true);
    expect(canUpload('docs_missing', row('under_review', 'certificate'), [])).toBe(false);
  });

  it('is closed in every other status', () => {
    for (const status of ['new', 'under_review', 'interview', 'accepted', 'rejected']) {
      expect(canUpload(status, row('rejected'), ['id_copy'])).toBe(false);
    }
  });
});

describe('safePortalReturn', () => {
  it('keeps same-site portal paths', () => {
    expect(safePortalReturn('/en/portal/documents', '/en/portal')).toBe('/en/portal/documents');
    expect(safePortalReturn('/ar/portal?x=1', '/ar/portal')).toBe('/ar/portal?x=1');
  });

  it('rejects open redirects, other areas and the login page itself', () => {
    for (const url of [
      '//evil.test/en/portal',
      'https://evil.test',
      '/en/admin',
      '/en/portal/login',
      '/en/portalx',
    ]) {
      expect(safePortalReturn(url, '/en/portal')).toBe('/en/portal');
    }
    expect(safePortalReturn(undefined, '/en/portal')).toBe('/en/portal');
  });
});
