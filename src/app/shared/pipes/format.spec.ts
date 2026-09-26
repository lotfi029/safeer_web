import { formatDate, formatFileSize, relativeTime, toArabicDigits } from './format';

describe('format helpers', () => {
  it('converts digits to Arabic-Indic', () => {
    expect(toArabicDigits('SA 2026')).toBe('SA ٢٠٢٦');
  });

  it('formats file sizes per locale', () => {
    expect(formatFileSize(512, 'en-GB')).toBe('512 byte');
    expect(formatFileSize(2.4 * 1024 * 1024, 'en-GB')).toBe('2.4 MB');
    expect(formatFileSize(5 * 1024 * 1024, 'ar-SA-u-ca-gregory-nu-arab')).toContain('٥');
  });

  it('formats dates in Riyadh time', () => {
    expect(formatDate('2020-07-30', 'long', 'en-GB')).toBe('30 July 2020');
    expect(formatDate('2020-07-30', 'long', 'ar-SA-u-ca-gregory-nu-arab')).toContain('٢٠٢٠');
    expect(formatDate('nonsense', 'long', 'en-GB')).toBe('');
  });

  it('formats relative time', () => {
    const now = new Date('2026-09-26T12:00:00Z');
    expect(relativeTime('2026-09-23T12:00:00Z', now, 'en-GB')).toBe('3 days ago');
    expect(relativeTime('2026-09-26T11:59:30Z', now, 'en-GB')).toBe('30 seconds ago');
  });
});
