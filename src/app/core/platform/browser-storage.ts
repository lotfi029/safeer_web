/**
 * Storage access that never throws (private mode, quota, disabled storage) and is a no-op on the
 * server. Values are JSON-encoded.
 */
export type StorageKind = 'local' | 'session';

function storage(kind: StorageKind): Storage | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  get<T>(kind: StorageKind, key: string): T | null {
    try {
      const raw = storage(kind)?.getItem(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  set(kind: StorageKind, key: string, value: unknown): boolean {
    try {
      const s = storage(kind);
      if (!s) {
        return false;
      }
      s.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(kind: StorageKind, key: string): void {
    try {
      storage(kind)?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
