import { safeStorage } from '../../core/platform/browser-storage';
import type { ApplyFormValue } from './apply-payload';

export const DRAFT_KEY = 'safeer.apply.draft';
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Never kept on the device (review F5). */
const SENSITIVE: readonly (keyof ApplyFormValue)[] = ['idNumber', 'birthDate'];

export type StoredDraft = Omit<Partial<ApplyFormValue>, 'idNumber' | 'birthDate'>;

interface DraftRecord {
  savedAt: number;
  value: StoredDraft;
}

/**
 * Offline copy of the apply form when autosave can't reach the API (review F5): sessionStorage
 * only (dies with the tab), without `idNumber`/`birthDate`, expires after 24h, cleared on submit,
 * logout and 401. The UI labels it "saved on this device".
 */
export function saveDraft(value: ApplyFormValue, now = Date.now()): boolean {
  const copy: Record<string, unknown> = { ...value };
  for (const key of SENSITIVE) {
    delete copy[key];
  }
  return safeStorage.set('session', DRAFT_KEY, { savedAt: now, value: copy } satisfies DraftRecord);
}

export function loadDraft(now = Date.now()): { savedAt: number; value: StoredDraft } | null {
  const record = safeStorage.get<DraftRecord>('session', DRAFT_KEY);
  if (!record || typeof record.savedAt !== 'number' || typeof record.value !== 'object') {
    return null;
  }
  if (now - record.savedAt > DRAFT_TTL_MS || record.savedAt > now) {
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
