import { isPersonName } from './person-name';
import { normalizePhone, toAsciiDigits } from './phone';

describe('isPersonName (mirrors API C16)', () => {
  it('accepts Arabic and Latin names with marks, spaces, apostrophes and hyphens', () => {
    for (const name of [
      'سارة',
      'عَبْدُ الله',
      'Anne-Marie',
      "O'Brien",
      'O’Neil',
      'José',
      'عبد الله بن علي',
    ]) {
      expect(isPersonName(name), name).toBe(true);
    }
  });

  it('rejects what the API rejects: digits, dots, @, /, other scripts, empty', () => {
    for (const name of ['Sara1', 'Dr. Ali', 'a@b', 'x/y', 'Иван', '张伟', '   ', '']) {
      expect(isPersonName(name), name).toBe(false);
    }
  });
});

describe('normalizePhone (mirrors API B2)', () => {
  it('normalises Saudi local, international and Arabic-Indic numbers to E.164', () => {
    expect(normalizePhone('0501234567')).toBe('+966501234567');
    expect(normalizePhone('501234567')).toBe('+966501234567');
    expect(normalizePhone('00966501234567')).toBe('+966501234567');
    expect(normalizePhone('966 50 123 4567')).toBe('+966501234567');
    expect(normalizePhone('+44 (20) 7946-0958')).toBe('+442079460958');
    expect(normalizePhone('٠٥٠١٢٣٤٥٦٧')).toBe('+966501234567');
    expect(normalizePhone('۰۵۰۱۲۳۴۵۶۷')).toBe('+966501234567');
  });

  it('rejects what the API rejects', () => {
    for (const raw of [
      '',
      null,
      undefined,
      '12',
      '0112345678',
      '+0123456789',
      'abc',
      '+1234567890123456',
    ]) {
      expect(normalizePhone(raw), String(raw)).toBeNull();
    }
  });

  it('converts both Arabic digit sets', () => {
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789 0123456789');
  });
});
