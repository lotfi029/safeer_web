import { HttpErrorResponse } from '@angular/common/http';

/**
 * Normalised RFC 7807 error (docs/api/CONTRACT-NOTES.md "Errors"):
 * `{ type, title, status, code, requestId, ...extra }`, validation issues in `extra.issues`
 * as zod issues `[{ path, message, code }]` (map `path[0]` to the form field).
 */
export interface ApiProblem {
  status: number;
  code: string;
  title: string;
  detail?: string;
  requestId?: string;
  /** `path[0]` → messages. */
  fieldErrors: Record<string, string[]>;
  /** Everything else the API sent (e.g. `missing` for DOCUMENTS_INCOMPLETE). */
  extra: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(readonly problem: ApiProblem) {
    super(`${problem.status} ${problem.code}`);
    this.name = 'ApiError';
  }
}

const KNOWN = new Set(['type', 'title', 'status', 'code', 'requestId', 'detail', 'issues']);

export function toApiProblem(error: unknown): ApiProblem {
  if (error instanceof ApiError) {
    return error.problem;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, code: 'INTERNAL_ERROR', title: String(error), fieldErrors: {}, extra: {} };
  }
  if (error.status === 0) {
    return { status: 0, code: 'NETWORK', title: 'Network error', fieldErrors: {}, extra: {} };
  }
  const body = (typeof error.error === 'object' && error.error) || {};
  const raw = body as Record<string, unknown>;
  const fieldErrors: Record<string, string[]> = {};
  const issues = Array.isArray(raw['issues']) ? (raw['issues'] as unknown[]) : [];
  for (const issue of issues) {
    const i = issue as { path?: unknown[]; message?: string };
    const key = String(i.path?.[0] ?? '_');
    (fieldErrors[key] ??= []).push(i.message ?? '');
  }
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!KNOWN.has(k)) {
      extra[k] = v;
    }
  }
  return {
    status: error.status,
    code: typeof raw['code'] === 'string' ? (raw['code'] as string) : fallbackCode(error.status),
    title: typeof raw['title'] === 'string' ? (raw['title'] as string) : error.statusText,
    detail: typeof raw['detail'] === 'string' ? (raw['detail'] as string) : undefined,
    requestId: typeof raw['requestId'] === 'string' ? (raw['requestId'] as string) : undefined,
    fieldErrors,
    extra,
  };
}

function fallbackCode(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_FAILED';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}

const KNOWN_CODES = new Set([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'APPLICATION_LOCKED',
  'APPLICATION_EXISTS',
  'OTP_INVALID',
  'DOCUMENTS_INCOMPLETE',
  'SLOT_ALREADY_BOOKED',
  'INTERVIEW_NOT_AVAILABLE',
  'INVALID_STATUS_TRANSITION',
  'QUOTA_EXCEEDED',
  'DOCUMENT_NOT_REVIEWABLE',
  'DOCUMENT_SUPERSEDED',
  'INVALID_ASSIGNEE',
  'REDIRECT_CHAIN',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'CONFLICT',
  'INTERNAL_ERROR',
]);

/** Transloco key for a problem code (`errors.codes.X`), or the generic/network message. */
export function problemMessageKey(problem: Pick<ApiProblem, 'code'>): string {
  if (problem.code === 'NETWORK') {
    return 'errors.network';
  }
  return KNOWN_CODES.has(problem.code) ? `errors.codes.${problem.code}` : 'errors.generic';
}
