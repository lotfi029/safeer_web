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
  /**
   * The primary published licence's number (footer bar, bylaws aside), written by the API on every
   * licence write; null (hidden) when there is none.
   */
  licenceNo?: string | null;
  /** That licence's issuer (`licenceIssuerAr`/`En`, collapsed). */
  licenceIssuer?: string | null;
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
  | 'news'
  | 'testimonials'
  | 'partners'
  | 'governance'
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
  /** Locale-agnostic path (`/contact`) after B9; legacy `#/x` values are mapped client-side. */
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

export type AboutItemKind = 'vision' | 'mission' | 'goal' | 'care_pillar';

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

/** `governance` categories have their own page under `/governance/:slug`. */
export type DocSectionGroup = 'governance' | 'other';

export interface DocCategory {
  id: Id;
  slug: string;
  name: string;
  sectionGroup?: DocSectionGroup;
}

export interface PublicDocument {
  id: Id;
  title: string;
  /** A short meta line (`metaAr`/`metaEn`, collapsed): e.g. a period or an edition. */
  meta?: string | null;
  docDate: string | null;
  /** `null`: the file isn't published yet («قريبًا»). */
  asset: Asset | null;
  sortOrder: number;
}

/** `GET /documents/sections`: the published governance categories, in order. */
export interface DocSection {
  id: Id;
  slug: string;
  name: string;
  sectionGroup: DocSectionGroup;
  count: number;
}

/** `GET /documents/sections/:slug` (404 for an unknown or unpublished section). */
export interface DocSectionResponse {
  category: DocCategory;
  documents: PublicDocument[];
}

/** `GET /licences` (primary first). */
export interface Licence {
  id: Id;
  title: string;
  number: string | null;
  issuer: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  isPrimary: boolean;
  asset: Asset | null;
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

export type ContactSubject = 'inquiry' | 'partnership' | 'support' | 'feedback' | 'other';

export const CONTACT_SUBJECTS: readonly ContactSubject[] = [
  'inquiry',
  'partnership',
  'support',
  'feedback',
  'other',
];

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

// ---------- staff ----------

export type StaffRole = 'admin' | 'editor' | 'support';

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
 * `unreadMessages` is admin + support; editors get no message counts at all. `recentAuditLog` is
 * admin-only (an empty array for other roles). The application figures (stat cards, the 6-month
 * series, the latest applications, `badges.newApplications`) were removed from the API with the
 * scholarship feature; an older API may still send them, so every block is optional and ignored.
 */
export interface AdminOverview {
  statCards?: {
    unreadMessages?: number;
  };
  contentAlerts?: {
    noPublishedPartners: boolean;
    legacyPostsCount: number;
    pagesNeedingReviewCount: number;
  };
  badges?: { unreadMessages?: number };
  recentAuditLog?: {
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
