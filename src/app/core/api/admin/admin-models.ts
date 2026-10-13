/**
 * Admin response shapes (safeer_api v1.0.0-rc1), read from the snapshot in docs/api/src: the
 * messages.service.ts and admin-newsletter.controller.ts.
 * Dates arrive as ISO strings.
 */
import type { ContactSubject, Id, Paged } from '../models';

export interface CsvExport {
  blob: Blob;
  filename: string;
  /** `X-Truncated: true`: the export stopped at the API's row cap. */
  truncated: boolean;
}

// ---------- messages ----------

export type MessageStatus = 'unread' | 'read' | 'archived';
/** Rows stored before the subject list changed may carry a retired value; render it raw. */
export type MessageSubject = ContactSubject;

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
