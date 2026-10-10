/**
 * Admin response shapes (safeer_api v1.0.0-rc1), read from the snapshot in docs/api/src: the
 * admin-applications service/controllers, messages.service.ts and admin-newsletter.controller.ts.
 * Dates arrive as ISO strings.
 */
import type {
  AdminApplicationDocument,
  ApplicationStatus,
  DegreeLevel,
  DocType,
  Gender,
  Id,
  Paged,
} from '../models';

// ---------- applications ----------

/** `GET /admin/applications` item (`ApplicationListItem`). */
export interface AdminApplicationListItem {
  id: Id;
  reference: string;
  status: ApplicationStatus;
  currentStep: number;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  university: string | null;
  degreeLevel: DegreeLevel | null;
  submittedAt: string | null;
  createdAt: string;
  assignedReviewer: { id: Id; name: string } | null;
  /** B3: every requested/rejected document has a fresh replacement nobody has reviewed yet. */
  hasUnreviewedResubmission: boolean;
}

export interface AdminApplicationQuery {
  status?: ApplicationStatus | null;
  q?: string | null;
  reviewerId?: Id | null;
  page?: number;
  limit?: number;
}

/** `GET /admin/applications/counts`: one count per status plus `all`. */
export type AdminApplicationCounts = Record<ApplicationStatus | 'all', number>;

/** `GET /admin/applications/assignees`: active, unlocked admins and reviewers. */
export interface AdminAssignee {
  id: Id;
  name: string;
  email: string;
  role: 'admin' | 'reviewer';
}

export type BulkAction = 'assign' | 'status' | 'request_documents';

export interface BulkActionBody {
  ids: Id[];
  action: BulkAction;
  reviewerId?: Id | null;
  status?: ApplicationStatus;
  docTypes?: DocType[];
  message?: string;
}

export interface BulkActionResult {
  id: Id;
  ok: boolean;
  error?: string;
}

export type ApplicationEventType =
  | 'STARTED'
  | 'SUBMITTED'
  | 'STATUS_CHANGED'
  | 'REVIEWER_ASSIGNED'
  | 'DOCS_REQUESTED'
  | 'DOCS_RECEIVED'
  | 'DOCS_RESUBMITTED'
  | 'DOCUMENT_ACCEPTED'
  | 'DOCUMENT_REJECTED'
  | 'APPLICANT_CORRECTED'
  | 'INTERVIEW_BOOKED'
  | 'INTERVIEW_CANCELLED';

export interface AdminApplicationEvent {
  id: Id;
  type: ApplicationEventType | string;
  actorId: Id | null;
  actorName: string | null;
  visibleToApplicant: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminApplicationNote {
  id: Id;
  body: string;
  authorId: Id | null;
  authorName: string | null;
  createdAt: string;
}

/** `GET /admin/applications/:id` (`getDetail`); `idNumber` is decrypted for admin/reviewer. */
export interface AdminApplicationDetail {
  id: Id;
  reference: string;
  status: ApplicationStatus;
  currentStep: number;
  personal: {
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
  };
  study: {
    university: string | null;
    major: string | null;
    degreeLevel: DegreeLevel | null;
    scholarshipNote: string | null;
  };
  consentAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  locale: 'ar' | 'en';
  createdAt: string;
  updatedAt: string;
  assignedReviewer: { id: Id; name: string; email: string } | null;
  /** Current (non-superseded) documents only. */
  documents: AdminApplicationDocument[];
  /** Newest first. */
  notes: AdminApplicationNote[];
  /** Every event, newest first (including the ones hidden from the applicant). */
  events: AdminApplicationEvent[];
}

export interface CsvExport {
  blob: Blob;
  filename: string;
  /** `X-Truncated: true`: the export stopped at the API's row cap. */
  truncated: boolean;
}

// ---------- messages ----------

export type MessageStatus = 'unread' | 'read' | 'archived';
export type MessageSubject = 'scholarship' | 'partnership' | 'feedback' | 'other';

export interface AdminMessageListItem {
  id: Id;
  name: string;
  email: string;
  subject: MessageSubject;
  status: MessageStatus;
  excerpt: string;
  createdAt: string;
}

export interface AdminMessagePage extends Paged<AdminMessageListItem> {
  unreadCount: number;
}

export interface AdminMessageReply {
  id: Id;
  body: string;
  authorId: Id | null;
  authorName: string | null;
  createdAt: string;
}

/** `GET /admin/messages/:id`: the ContactMessage row plus its replies (opening it marks it read). */
export interface AdminMessage {
  id: Id;
  name: string;
  phone: string | null;
  email: string;
  subject: MessageSubject;
  body: string;
  status: MessageStatus;
  locale: 'ar' | 'en';
  createdAt: string;
  updatedAt: string;
  replies: AdminMessageReply[];
}

export interface ConvertToTestimonialBody {
  quoteAr: string;
  quoteEn?: string;
  authorName?: string;
  authorDesc?: string;
}

export interface AdminTestimonial {
  id: Id;
  quoteAr: string;
  quoteEn: string | null;
  authorName: string;
  authorDescAr: string | null;
  authorDescEn: string | null;
  status: 'pending' | 'published' | 'hidden';
  source: string;
  sourceMessageId: Id | null;
}
