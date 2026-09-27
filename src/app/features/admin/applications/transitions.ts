import type { ApplicationStatus } from '../../../core/api/models';

/**
 * The staff status-transition map, a copy of safeer_api `admin-applications/transitions.ts`
 * (drift-tested against the rc1 snapshot in transitions.node.test.ts). `draft -> new` happens only
 * through the applicant's own submit; `accepted` and `rejected` are terminal.
 */
export const APPLICATION_STATUS_TRANSITIONS: Readonly<
  Record<ApplicationStatus, readonly ApplicationStatus[]>
> = {
  draft: [],
  new: ['under_review'],
  under_review: ['docs_missing', 'interview', 'accepted', 'rejected'],
  docs_missing: ['under_review'],
  interview: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};

/** Request-documents (which also sets `docs_missing`) is allowed from a broader set of states. */
export const REQUEST_DOCUMENTS_ALLOWED_FROM: readonly ApplicationStatus[] = [
  'new',
  'under_review',
  'interview',
];

/** Statuses a status change (PATCH or the bulk action) may target from `from`. */
export function nextStatuses(from: ApplicationStatus): readonly ApplicationStatus[] {
  return APPLICATION_STATUS_TRANSITIONS[from] ?? [];
}

export function canRequestDocuments(from: ApplicationStatus): boolean {
  return REQUEST_DOCUMENTS_ALLOWED_FROM.includes(from);
}

/** Document review is closed on drafts and decided applications (C34, `DOCUMENT_NOT_REVIEWABLE`). */
export function canReviewDocuments(status: ApplicationStatus): boolean {
  return !['draft', 'accepted', 'rejected'].includes(status);
}

/** Every status that can be a status-change target anywhere in the map (the bulk action's options). */
export const SETTABLE_STATUSES: readonly ApplicationStatus[] = [
  ...new Set(Object.values(APPLICATION_STATUS_TRANSITIONS).flat()),
];
