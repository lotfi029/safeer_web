/**
 * Response models, hand-typed from the API mappers (docs/api/src/**) and docs/api/CONTRACT-NOTES.md
 * (openapi.json declares no response schemas). Public endpoints collapse `xAr`/`xEn` pairs into `x`
 * (Arabic fallback), so the public models below use the collapsed names. IDs are strings.
 */

export type Id = string;

// ---------- shared ----------

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** `PublicMediaAsset`. Files: `/files/{publicId}` (original) or `/files/{publicId}/{thumb|card|full}` (WebP). */
export interface Asset {
  id: Id;
  publicId: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  /** Original dimensions (variants never enlarge: 400/800/1600 wide at most). */
  widthPx: number | null;
  heightPx: number | null;
  alt: string | null;
}

// ---------- site / home / pages ----------

export interface SiteSettings {
  id: Id;
  orgName: string;
  tagline: string | null;
  footerBlurb: string | null;
  rightsLine: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  linkedinUrl: string | null;
  whatsappUrl: string | null;
  tiktokUrl: string | null;
  /**
   * A12: an iframe `src` for the contact page's map. The API only accepts https Google Maps embeds
   * (`https://www.google.com/maps/embed…`) and OpenStreetMap (`https://www.openstreetmap.org/…`); the
   * CSP `frame-src` allows exactly those two origins.
   */
  mapEmbedUrl: string | null;
  /** A12: the pin (−90…90 / −180…180), used for the "open in maps" link. */
  mapLat: number | null;
  mapLng: number | null;
  enEnabled: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

/** Fixed nav slugs (CONTRACT-NOTES): map `work` → `/work-areas`, `home` → `/`. */
export type NavSlug =
  | 'home'
  | 'about'
  | 'board'
  | 'work'
  | 'scholarships'
  | 'news'
  | 'testimonials'
  | 'partners'
  | 'documents'
  | 'contact';

export interface NavItem {
  slug: NavSlug | string;
  label: string;
}

export interface SiteResponse {
  settings: SiteSettings | null;
  nav: NavItem[];
  contact: { phone: string | null; email: string | null; address: string | null };
}

/** `sectionKey` seed order: hero about impact work_areas student_care news testimonials partners cta. */
export interface PageSection {
  id: Id;
  sectionKey: string;
  label: string | null;
  heading: string | null;
  /** Sanitized HTML after backend C26 (render via SafeHtml only). */
  body: string | null;
  primaryButtonLabel: string | null;
  /** Locale-agnostic path (`/apply`) after B9; legacy `#/x` values are mapped client-side. */
  primaryButtonUrl: string | null;
  secondaryButtonLabel: string | null;
  secondaryButtonUrl: string | null;
  imageAsset: Asset | null;
  sortOrder: number;
}

export interface Page {
  id: Id;
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  sections: PageSection[];
}

export interface Stat {
  id: Id;
  /** `null` renders `[—]` (spec §6.2: no invented numbers). */
  value: string | null;
  label: string;
  sub: string | null;
  sortOrder: number;
}

export interface AboutItem {
  id: Id;
  icon: string | null;
  title: string;
  /** Sanitized HTML after backend C26. */
  body: string | null;
  sortOrder: number;
}

export type AboutItemKind =
  'vision' | 'mission' | 'goal' | 'care_pillar' | 'scholarship_step' | 'requirement';

/** B18: `GET /about-items?kind=a,b` → grouped by kind. */
export type AboutItemsResponse = Partial<Record<AboutItemKind, AboutItem[]>>;

export interface WorkAreaItem {
  id: Id;
  text: string;
  sortOrder: number;
}

export interface WorkArea {
  id: Id;
  icon: string | null;
  title: string;
  sortOrder: number;
  items: WorkAreaItem[];
}

export interface BoardMember {
  id: Id;
  name: string;
  role: string;
  grp: 'board' | 'executive';
  isLead: boolean;
  photoAsset: Asset | null;
  /** B12. */
  bio: string | null;
  sortOrder: number;
}

/** GET /board: members grouped (board.controller.ts), each group in sortOrder. W1. */
export interface BoardResponse {
  board: BoardMember[];
  executive: BoardMember[];
}

export interface Testimonial {
  id: Id;
  quote: string;
  authorName: string;
  authorDesc: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

export interface TestimonialTheme {
  id: Id;
  title: string;
  description: string | null;
  isImprovement: boolean;
  sortOrder: number;
}

export interface TestimonialsResponse {
  featured: Testimonial[];
  list: Testimonial[];
  themes: TestimonialTheme[];
}

export type PartnerCategory = 'government' | 'university' | 'association' | 'supporter';

export interface Partner {
  id: Id;
  name: string;
  category: PartnerCategory;
  url: string | null;
  logoAsset: Asset | null;
  sortOrder: number;
}

export interface DocCategory {
  id: Id;
  slug: string;
  name: string;
}

export interface PublicDocument {
  id: Id;
  title: string;
  docDate: string | null;
  asset: Asset | null;
  sortOrder: number;
}

export interface DocumentGroup {
  category: DocCategory;
  documents: PublicDocument[];
}

export interface HomeResponse {
  settings: SiteSettings | null;
  sections: PageSection[];
  aboutItems: { goals: AboutItem[]; carePillars: AboutItem[] };
  stats: Stat[];
  workAreas: WorkArea[];
  news: PostSummary[];
  testimonials: Testimonial[];
  partners: Partner[];
}

// ---------- news ----------

export interface NewsCategory {
  id: Id;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface PostSummary {
  id: Id;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedOn: string | null;
  isFeatured: boolean;
  coverAsset: Asset | null;
  category: NewsCategory | null;
}

export interface PostDetail extends PostSummary {
  /** Sanitized HTML (backend MarkdownService + DOMPurify). */
  body: string | null;
  readMinutes: number;
  related: PostSummary[];
  /**
   * C41: only with a valid `?preview=` token — `preview=<token>&post=<id>`. Append it to this post's
   * `/files/…` URLs so an unpublished cover loads without a session.
   */
  previewFileQuery?: string;
}

// ---------- forms ----------

export type ContactSubject = 'scholarship' | 'partnership' | 'feedback' | 'other';

export interface ContactRequest {
  name: string;
  email: string;
  phone?: string | null;
  subject: ContactSubject;
  body: string;
  website?: string;
  formRenderedAt: number;
}

export interface NewsletterRequest {
  email: string;
  website?: string;
  formRenderedAt: number;
}

export interface OkResponse {
  ok: true;
  /** C27: double opt-in. */
  pendingConfirmation?: boolean;
}

/** C27: `POST /newsletter/confirm` and `/newsletter/unsubscribe`; both values come from the mailed link. */
export interface NewsletterTokenRequest {
  email: string;
  token: string;
}

export interface Country {
  code: string;
  name: string;
}

// ---------- applications / portal ----------

export type ApplicationStatus =
  'draft' | 'new' | 'under_review' | 'docs_missing' | 'interview' | 'accepted' | 'rejected';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'draft',
  'new',
  'under_review',
  'docs_missing',
  'interview',
  'accepted',
  'rejected',
];

export type Gender = 'male' | 'female';
export type DegreeLevel = 'bachelor' | 'master' | 'phd';
export type DocType = 'id_copy' | 'certificate' | 'admission_letter' | 'other';
export const REQUIRED_DOC_TYPES: readonly DocType[] = [
  'id_copy',
  'certificate',
  'admission_letter',
];

export interface ApplicationPersonal {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  birthDate: string | null;
  phone: string | null;
  nationality: string | null;
  idNumber: string | null;
  email: string | null;
  currentJob: string | null;
  gender: Gender | null;
}

export interface ApplicationStudy {
  university: string | null;
  major: string | null;
  degreeLevel: DegreeLevel | null;
  scholarshipNote: string | null;
}

export type TimelineKey = 'received' | 'documents' | 'review' | 'interview' | 'decision';
export type TimelineState = 'done' | 'now' | 'pending';

export interface ActionNeeded {
  type: 'document_rejected' | 'documents_requested';
  docType?: DocType;
  docTypes?: DocType[];
  reason?: string | null;
  message?: string | null;
}

export interface PortalEvent {
  id: Id;
  type: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface InterviewBooking {
  id: Id;
  startsAt: string;
  endsAt: string;
  location: string | null;
}

export interface PortalMe {
  reference: string;
  status: ApplicationStatus;
  currentStep: number;
  personal: ApplicationPersonal;
  study: ApplicationStudy;
  submittedAt: string | null;
  decidedAt: string | null;
  timeline: { key: TimelineKey; state: TimelineState }[];
  actionNeeded: ActionNeeded | null;
  recentEvents: PortalEvent[];
  /** C17: the booked slot, or null. */
  interview: InterviewBooking | null;
  /** B16: the same token verify-otp issued, so it survives a reload. */
  csrfToken: string;
}

/** Step-1 fields (`POST /applications`, strict). */
export interface ApplicationStep1 {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  birthDate: string;
  phone: string;
  nationality: string;
  idNumber?: string | null;
  email: string;
  currentJob?: string | null;
  gender: Gender;
}

/** `PATCH /portal/application`: strict partial. Only these four may be `null` (F4). */
export type ApplicationPatch = Partial<
  Omit<ApplicationStep1, 'middleName' | 'idNumber' | 'currentJob'> & {
    middleName: string | null;
    idNumber: string | null;
    currentJob: string | null;
    university: string;
    major: string;
    degreeLevel: DegreeLevel;
    scholarshipNote: string | null;
    consent: boolean;
  }
>;

/**
 * C15: `PATCH /portal/application/corrections` while `docs_missing`. A strict partial of these
 * fields, at least one of them; never email or phone. `middleName`/`idNumber` may be `null`.
 */
export type ApplicationCorrections = Partial<{
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: string;
  nationality: string;
  idNumber: string | null;
  university: string;
  major: string;
  degreeLevel: DegreeLevel;
}>;

export interface CorrectApplicationResponse {
  status: ApplicationStatus;
  corrected: string[];
}

export interface CreateApplicationResponse {
  reference: string;
  csrfToken: string;
}

export interface PatchApplicationResponse {
  status: ApplicationStatus;
  currentStep: number;
}

export interface SubmitApplicationResponse {
  status: 'new';
  submittedAt: string;
}

/** B19: only the public fields are typed; `storageKey`/`checksum` are never read. */
export interface ApplicantDocument {
  id: Id;
  docType: DocType;
  originalName: string;
  mime: string;
  sizeBytes: number;
  status: 'under_review' | 'accepted' | 'rejected';
  rejectionReason: string | null;
  createdAt: string;
}

export interface PortalDocumentsResponse {
  documents: ApplicantDocument[];
  completeness: { done: number; required: number; missingTypes: DocType[] };
}

export interface InterviewSlot {
  id: Id;
  startsAt: string;
  endsAt: string;
  location: string | null;
}

export type OtpChannel = 'sms' | 'email';

/**
 * `POST /portal/auth/request-otp` (A4): answered at once, before the identifier is even looked up, and
 * the same whether or not it matches. It never means a message went out: the code arrives a moment
 * later (up to ~5 s when SMS falls back to email). `channelHint` is the channel the request would use.
 */
export interface RequestOtpResponse {
  ok: true;
  channelHint: OtpChannel;
}

// ---------- staff ----------

export type StaffRole = 'admin' | 'reviewer' | 'editor' | 'support';

export interface StaffUser {
  id: Id;
  name: string;
  email: string;
  role: StaffRole;
  /** C12: a brute-force lock is running (`lockedUntil` is in the future, at most an hour ahead: A3). */
  isLocked: boolean;
  lockedUntil: string | null;
  failedLogins: number;
  /** C3: only an admin changes it. */
  status: 'active' | 'disabled' | 'invited';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMe extends StaffUser {
  csrfToken: string;
}

/** B17: `GET /admin/roles` (any staff). */
export interface RolesResponse {
  roles: StaffRole[];
  matrix: Record<string, StaffRole[]>;
}

/**
 * `GET /admin/overview` (C20, A5): each block is present only for the roles that own its area.
 * Application figures (`newApplications`, `underReview`, `acceptedThisMonth`, `series`,
 * `latestApplications`) are admin + reviewer. `unreadMessages` is admin + support; editors get no
 * message counts at all. `recentAuditLog` is admin-only (an empty array for other roles).
 */
export interface AdminOverview {
  statCards: {
    newApplications?: number;
    underReview?: number;
    acceptedThisMonth?: number;
    unreadMessages?: number;
  };
  series?: { month: string; received: number; accepted: number }[];
  latestApplications?: {
    id: Id;
    reference: string;
    name: string;
    status: ApplicationStatus;
    submittedAt: string | null;
  }[];
  contentAlerts: {
    noPublishedPartners: boolean;
    legacyPostsCount: number;
    pagesNeedingReviewCount: number;
  };
  badges: { newApplications?: number; unreadMessages?: number };
  recentAuditLog: {
    id: Id;
    action: string;
    entityType: string;
    entityId: string | null;
    entityLabel: string | null;
    actorId: Id | null;
    actorName: string | null;
    createdAt: string;
  }[];
}

/** B19 + A11: a document in `GET /admin/applications/:id` (and the review PATCH response). */
export interface AdminApplicationDocument extends ApplicantDocument {
  reviewedBy: Id | null;
  reviewedAt: string | null;
  supersededAt: string | null;
  /**
   * The file route relative to the API base (`admin/applications/{id}/documents/{docId}/file`), or
   * `null` for a superseded document, whose file was deleted. Show a download link only when it is
   * set; the route answers 410 `DOCUMENT_SUPERSEDED` for a superseded document.
   */
  downloadPath: string | null;
}
