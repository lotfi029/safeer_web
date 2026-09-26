/** MIME types the backend accepts for application documents (safeer_api upload rules). */
export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png';
/** Backend limit: 5 MB per file. */
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export type FileRejectReason = 'type' | 'size' | 'count';

export interface FileRejection {
  file: File;
  reason: FileRejectReason;
}

export interface FileValidationOptions {
  /** Comma-separated MIME types (`image/png`), wildcards (`image/*`) or extensions (`.pdf`). */
  accept: string;
  maxBytes: number;
  multiple: boolean;
}

export interface FileValidationResult {
  accepted: File[];
  rejected: FileRejection[];
}

/** Used when the browser reports no MIME type (some OS/browser combos leave `File.type` empty). */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isAcceptedType(file: File, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) {
    return true;
  }
  const ext = extensionOf(file.name);
  const mime = (file.type || MIME_BY_EXTENSION[ext] || '').toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) {
      return rule.slice(1) === ext;
    }
    if (rule.endsWith('/*')) {
      return mime.startsWith(rule.slice(0, -1));
    }
    return rule === mime;
  });
}

/**
 * Client-side mirror of the backend upload validation: type (MIME, or extension when the MIME is
 * empty), size ≤ maxBytes, and one file unless `multiple`. Extra files beyond the first are
 * rejected with `count` when `multiple` is false.
 */
export function validateFiles(files: readonly File[], options: FileValidationOptions): FileValidationResult {
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  files.forEach((file, index) => {
    if (!options.multiple && index > 0) {
      rejected.push({ file, reason: 'count' });
    } else if (!isAcceptedType(file, options.accept)) {
      rejected.push({ file, reason: 'type' });
    } else if (file.size > options.maxBytes) {
      rejected.push({ file, reason: 'size' });
    } else {
      accepted.push(file);
    }
  });
  return { accepted, rejected };
}
