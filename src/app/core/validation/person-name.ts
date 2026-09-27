/**
 * W14: mirrors the API's C16 rule (safeer_api `src/common/validation/person-name.ts`): Arabic or
 * Latin letters with their combining marks, spaces, apostrophes and hyphens only. No digits, dots,
 * `@`, `/` or other scripts, so the client rejects exactly what the API would (whose English zod
 * message would otherwise leak into the Arabic UI). Keep in sync with the API.
 */
export const PERSON_NAME_RE = /^(?:(?=[\p{Script=Arabic}\p{Script=Latin}])\p{L}|\p{M}|['’ -])+$/u;

export function isPersonName(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && PERSON_NAME_RE.test(v);
}
