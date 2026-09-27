import { plainText } from './plain-text';

describe('plainText', () => {
  it('turns tags into spaces and collapses whitespace', () => {
    expect(plainText('<p>دعم <strong>أكاديمي</strong></p>\n<p>ونفسي</p>')).toBe(
      'دعم أكاديمي ونفسي',
    );
  });

  it('decodes named and numeric entities once', () => {
    expect(plainText('Q&amp;A &lt;b&gt; &quot;x&quot; &#39;y&#39; &#x2014; a&nbsp;b')).toBe(
      'Q&A <b> "x" \'y\' — a b',
    );
    expect(plainText('&amp;lt;')).toBe('&lt;');
  });

  it('leaves unknown or invalid entities as they are', () => {
    expect(plainText('&bogus; &#0; &#x110000;')).toBe('&bogus; &#0; &#x110000;');
  });

  it('returns null for empty input or markup with no text', () => {
    expect(plainText(null)).toBeNull();
    expect(plainText(undefined)).toBeNull();
    expect(plainText('')).toBeNull();
    expect(plainText('<p> </p><br>')).toBeNull();
  });
});
