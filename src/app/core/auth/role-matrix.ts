import type { StaffRole } from '../api/models';

/**
 * Typed fallback for the role matrix. The runtime source of truth is `GET /admin/roles` (B17, mocked
 * until live); this copy (docs/api/CONTRACT-NOTES.md "Staff") is used only if that call fails.
 * Never hard-code roles into menus: read `StaffSessionStore.can(area)`.
 */
export const ROLE_MATRIX: Readonly<Record<string, readonly StaffRole[]>> = {
  applications: ['admin', 'reviewer'],
  'interview-slots': ['admin', 'reviewer'],
  pages: ['admin', 'editor'],
  news: ['admin', 'editor'],
  'work-areas': ['admin', 'editor'],
  board: ['admin', 'editor'],
  stats: ['admin', 'editor'],
  'about-items': ['admin', 'editor'],
  partners: ['admin', 'editor'],
  documents: ['admin', 'editor'],
  media: ['admin', 'editor'],
  redirects: ['admin', 'editor'],
  messages: ['admin', 'support'],
  testimonials: ['admin', 'support'],
  newsletter: ['admin', 'support'],
  users: ['admin'],
  settings: ['admin'],
  mail: ['admin'],
  sms: ['admin'],
  audit: ['admin'],
  cache: ['admin'],
};
