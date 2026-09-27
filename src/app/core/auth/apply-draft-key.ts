/**
 * sessionStorage key of the apply form's offline copy (features/apply/apply-draft.ts). It lives in
 * core so ApplicantSessionStore can clear the copy on logout and 401 without importing the apply
 * feature (W10).
 */
export const APPLY_DRAFT_KEY = 'safeer.apply.draft';
