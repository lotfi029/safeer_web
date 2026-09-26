import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES, isAcceptedType, validateFiles } from './validate-files';

function file(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

const OPTS = { accept: DOCUMENT_ACCEPT, maxBytes: DOCUMENT_MAX_BYTES, multiple: false };

describe('validateFiles', () => {
  it('accepts the backend MIME types', () => {
    expect(isAcceptedType(file('a.pdf', 'application/pdf'), DOCUMENT_ACCEPT)).toBe(true);
    expect(isAcceptedType(file('a.jpg', 'image/jpeg'), DOCUMENT_ACCEPT)).toBe(true);
    expect(isAcceptedType(file('a.png', 'image/png'), DOCUMENT_ACCEPT)).toBe(true);
    expect(isAcceptedType(file('a.gif', 'image/gif'), DOCUMENT_ACCEPT)).toBe(false);
    expect(isAcceptedType(file('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), DOCUMENT_ACCEPT)).toBe(false);
  });

  it('falls back to the extension when MIME is empty', () => {
    expect(isAcceptedType(file('scan.JPEG', ''), DOCUMENT_ACCEPT)).toBe(true);
    expect(isAcceptedType(file('doc.pdf', ''), DOCUMENT_ACCEPT)).toBe(true);
    expect(isAcceptedType(file('doc.exe', ''), DOCUMENT_ACCEPT)).toBe(false);
    expect(isAcceptedType(file('noext', ''), DOCUMENT_ACCEPT)).toBe(false);
  });

  it('does not trust the extension when a MIME type is present', () => {
    expect(isAcceptedType(file('fake.pdf', 'text/html'), DOCUMENT_ACCEPT)).toBe(false);
  });

  it('supports extensions and wildcards in accept', () => {
    expect(isAcceptedType(file('a.png', 'image/png'), 'image/*')).toBe(true);
    expect(isAcceptedType(file('a.pdf', 'application/pdf'), '.pdf')).toBe(true);
    expect(isAcceptedType(file('a.pdf', 'application/pdf'), '')).toBe(true);
  });

  it('rejects oversized files (limit inclusive)', () => {
    const ok = file('a.pdf', 'application/pdf', 100);
    const big = file('b.pdf', 'application/pdf', 101);
    const result = validateFiles([ok], { ...OPTS, maxBytes: 100 });
    expect(result.accepted).toEqual([ok]);
    expect(validateFiles([big], { ...OPTS, maxBytes: 100 }).rejected).toEqual([{ file: big, reason: 'size' }]);
  });

  it('rejects extra files when multiple is false', () => {
    const a = file('a.pdf', 'application/pdf');
    const b = file('b.pdf', 'application/pdf');
    expect(validateFiles([a, b], OPTS)).toEqual({ accepted: [a], rejected: [{ file: b, reason: 'count' }] });
    expect(validateFiles([a, b], { ...OPTS, multiple: true }).accepted).toEqual([a, b]);
  });

  it('reports type before size', () => {
    const bad = file('a.gif', 'image/gif', 10);
    expect(validateFiles([bad], { ...OPTS, maxBytes: 1 }).rejected[0].reason).toBe('type');
  });
});
