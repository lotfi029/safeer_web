/**
 * W14: mirrors the API's `normalizePhone` (safeer_api `src/common/phone.ts`, B2), including its
 * Arabic-Indic (٠-٩) and Persian (۰-۹) digit normalisation, so a number typed on an Arabic keyboard
 * is accepted like the API accepts it. Keep in sync with the API.
 *
 *   `05XXXXXXXX` / `5XXXXXXXX`        → `+9665XXXXXXXX`
 *   `00966XXXXXXXXX` / `966XXXXXXXXX` → `+966XXXXXXXXX`
 *   `+<country><number>`              → as is, once cleaned
 * Anything that doesn't end up as E.164 (`+`, then 8–15 digits, the first 1–9) is `null`.
 */
const E164_RE = /^\+[1-9]\d{7,14}$/;
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const arabic = ARABIC_INDIC_DIGITS.indexOf(ch);
    return String(arabic !== -1 ? arabic : PERSIAN_DIGITS.indexOf(ch));
  });
}

export function normalizePhone(raw: string | null | undefined, defaultCc = '966'): string | null {
  if (!raw) {
    return null;
  }
  let value = toAsciiDigits(raw).replace(/[\s\-.()]/g, '');
  if (!value) {
    return null;
  }
  if (value.startsWith('00')) {
    value = `+${value.slice(2)}`;
  }
  if (/^05\d{8}$/.test(value)) {
    value = `+${defaultCc}${value.slice(1)}`;
  } else if (/^5\d{8}$/.test(value)) {
    value = `+${defaultCc}${value}`;
  } else if (/^\d/.test(value)) {
    value = `+${value}`;
  }
  return E164_RE.test(value) ? value : null;
}
