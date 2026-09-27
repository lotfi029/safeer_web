import { APPLY_DRAFT_KEY } from '../../core/auth/apply-draft-key';
import { safeStorage } from '../../core/platform/browser-storage';
import type { ApplyFormValue } from './apply-payload';

export const DRAFT_KEY = APPLY_DRAFT_KEY;
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Never kept on the device (review F5). */
const SENSITIVE: readonly (keyof ApplyFormValue)[] = ['idNumber', 'birthDate'];

export type StoredDraft = Omit<Partial<ApplyFormValue>, 'idNumber' | 'birthDate'>;

interface DraftRecord {
  savedAt: number;
  /** The application the copy belongs to (W10): never offered to another one. */
  reference: string;
  value: StoredDraft;
}

/**
 * Offline copy of the apply form when autosave can't reach the API (review F5): sessionStorage
 * only (dies with the tab), without `idNumber`/`birthDate`, expires after 24h, cleared on submit,
 * and by ApplicantSessionStore on logout and 401 (W10). Tied to its application's `reference`, so
 * a later applicant in the same tab is never offered it. The UI labels it "saved on this device".
 */
export function saveDraft(value: ApplyFormValue, reference: string, now = Date.now()): boolean {
  const copy: Record<string, unknown> = { ...value };
  for (const key of SENSITIVE) {
    delete copy[key];
  }
  return safeStorage.set('session', DRAFT_KEY, {
    savedAt: now,
    reference,
    value: copy,
  } satisfies DraftRecord);
}

export function loadDraft(
  reference: string,
  now = Date.now(),
): { savedAt: number; value: StoredDraft } | null {
  const record = safeStorage.get<DraftRecord>('session', DRAFT_KEY);
  if (!record || typeof record.savedAt !== 'number' || typeof record.value !== 'object') {
    return null;
  }
  if (
    record.reference !== reference ||
    now - record.savedAt > DRAFT_TTL_MS ||
    record.savedAt > now
  ) {
    clearDraft();
    return null;
  }
  const value = { ...record.value } as Record<string, unknown>;
  for (const key of SENSITIVE) {
    delete value[key];
  }
  return { savedAt: record.savedAt, value: value as StoredDraft };
}

export function clearDraft(): void {
  safeStorage.remove('session', DRAFT_KEY);
}
