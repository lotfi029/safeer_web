import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_PREFIX } from '../../config/api-base-url';
import type { Id, Paged, StaffRole, StaffUser } from '../models';
import { attachmentName, queryParams } from './admin-api';
import type { CsvExport } from './admin-models';

const A = `${API_PREFIX}/admin`;
const enc = encodeURIComponent;

// ---------- models (safeer_api v1.0.0-rc1: users, site-settings, mail, sms, audit, newsletter, auth) ----------

export interface SiteSettings {
  id: Id;
  orgNameAr: string;
  orgNameEn: string | null;
  taglineAr: string | null;
  taglineEn: string | null;
  footerBlurbAr: string | null;
  footerBlurbEn: string | null;
  rightsLineAr: string | null;
  rightsLineEn: string | null;
  phone: string | null;
  email: string | null;
  addressAr: string | null;
  addressEn: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  linkedinUrl: string | null;
  whatsappUrl: string | null;
  tiktokUrl: string | null;
  mapEmbedUrl: string | null;
  mapLat: number | null;
  mapLng: number | null;
  enEnabled: boolean;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  notifyEmailOnStatusChange: boolean;
  notifySmsOnStatusChange: boolean;
  applicationRefPrefix: string;
  updatedBy: Id | null;
  updatedAt: string;
}

export interface MailSettings {
  id: Id;
  isEnabled: boolean;
  driver: 'smtp' | 'log';
  host: string | null;
  port: number | null;
  encryption: 'none' | 'tls' | 'starttls';
  username: string | null;
  fromNameAr: string | null;
  fromNameEn: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  notifyEmail: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
  updatedAt: string;
  /** The password is never returned; this says whether one is stored. */
  passwordIsSet: boolean;
}

export interface SmsSettings {
  id: Id;
  isEnabled: boolean;
  driver: 'log' | 'http' | 'unifonic';
  providerUrl: string | null;
  senderName: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
  updatedAt: string;
  /** The token is never returned; this says whether one is stored. */
  tokenIsSet: boolean;
}

export interface MessageTemplate {
  id: Id;
  key: string;
  nameAr: string;
  nameEn: string | null;
  /** Mail only. */
  subjectAr?: string;
  subjectEn?: string | null;
  bodyAr: string;
  bodyEn: string | null;
  variables: string[];
  isEnabled: boolean;
  updatedAt: string;
}

export type LogStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export interface MessageLog {
  id: Id;
  templateKey: string;
  locale: 'ar' | 'en';
  /** Mail. */
  toEmail?: string;
  subject?: string;
  hasPayload?: boolean;
  nextRetryAt?: string | null;
  /** SMS. */
  toPhone?: string;
  status: LogStatus;
  attempts: number;
  error: string | null;
  entityType: string | null;
  entityId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface AuditRow {
  id: Id;
  actorId: Id | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  diff: { before: unknown; after: unknown } | null;
  createdAt: string;
}

export interface Subscriber {
  id: Id;
  email: string;
  locale: 'ar' | 'en';
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

export type SubscriberStatus = 'subscribed' | 'pending' | 'unsubscribed';

export function subscriberStatus(
  s: Pick<Subscriber, 'confirmedAt' | 'unsubscribedAt'>,
): SubscriberStatus {
  return s.unsubscribedAt ? 'unsubscribed' : s.confirmedAt ? 'subscribed' : 'pending';
}

export interface StaffSession {
  id: Id;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export interface CacheStats {
  entries: number;
  maxEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  uptimeSeconds: number;
}

export type Channel = 'mail' | 'sms';

/** Users, settings, mail/SMS, audit, newsletter, account and cache (Stage 2, Phase 9). */
@Injectable({ providedIn: 'root' })
export class SystemApi {
  private readonly http = inject(HttpClient);

  // ---------- users ----------
  users(): Observable<StaffUser[]> {
    return this.http.get<StaffUser[]>(`${A}/users`);
  }
  invite(body: { email: string; name: string; role: StaffRole }): Observable<StaffUser> {
    return this.http.post<StaffUser>(`${A}/auth/invite`, body);
  }
  updateUser(
    id: Id,
    body: Partial<{
      name: string;
      email: string;
      role: StaffRole;
      status: 'active' | 'disabled';
      unlock: true;
    }>,
  ): Observable<StaffUser> {
    return this.http.patch<StaffUser>(`${A}/users/${enc(id)}`, body);
  }
  deleteUser(id: Id): Observable<{ deleted: true }> {
    return this.http.delete<{ deleted: true }>(`${A}/users/${enc(id)}`);
  }

  // ---------- settings ----------
  settings(): Observable<SiteSettings> {
    return this.http.get<SiteSettings>(`${A}/settings`);
  }
  saveSettings(body: Partial<SiteSettings>): Observable<SiteSettings> {
    return this.http.put<SiteSettings>(`${A}/settings`, body);
  }
  cacheStats(): Observable<CacheStats> {
    return this.http.get<CacheStats>(`${A}/cache/stats`);
  }
  purgeCache(): Observable<{ purged: number; tag: string | null }> {
    return this.http.delete<{ purged: number; tag: string | null }>(`${A}/cache`);
  }

  // ---------- mail / SMS ----------
  channelSettings<T extends MailSettings | SmsSettings>(channel: Channel): Observable<T> {
    return this.http.get<T>(`${A}/${channel}/settings`);
  }
  saveChannelSettings<T extends MailSettings | SmsSettings>(
    channel: Channel,
    body: object,
  ): Observable<T> {
    return this.http.put<T>(`${A}/${channel}/settings`, body);
  }
  testChannel(channel: Channel, to: string): Observable<{ ok: boolean; error?: string }> {
    return this.http.post<{ ok: boolean; error?: string }>(`${A}/${channel}/test`, { to });
  }
  templates(channel: Channel): Observable<MessageTemplate[]> {
    return this.http.get<MessageTemplate[]>(`${A}/${channel}/templates`);
  }
  saveTemplate(channel: Channel, key: string, body: object): Observable<MessageTemplate> {
    return this.http.put<MessageTemplate>(`${A}/${channel}/templates/${enc(key)}`, body);
  }
  previewTemplate(
    channel: Channel,
    key: string,
    locale: 'ar' | 'en',
  ): Observable<{ subject?: string; html?: string; text?: string; message?: string }> {
    return this.http.post<{ subject?: string; html?: string; text?: string; message?: string }>(
      `${A}/${channel}/templates/${enc(key)}/preview`,
      { locale },
    );
  }
  log(
    channel: Channel,
    query: { page?: number; limit?: number; status?: LogStatus | null; template?: string | null },
  ): Observable<Paged<MessageLog>> {
    return this.http.get<Paged<MessageLog>>(`${A}/${channel}/log`, { params: queryParams(query) });
  }
  retryMail(id: Id): Observable<MessageLog> {
    return this.http.post<MessageLog>(`${A}/mail/log/${enc(id)}/retry`, {});
  }

  // ---------- audit ----------
  audit(query: {
    page?: number;
    limit?: number;
    entity?: string | null;
    actor?: string | null;
  }): Observable<Paged<AuditRow>> {
    return this.http.get<Paged<AuditRow>>(`${A}/audit`, { params: queryParams(query) });
  }

  // ---------- newsletter ----------
  subscribers(query: {
    page?: number;
    limit?: number;
    status?: SubscriberStatus | null;
  }): Observable<Paged<Subscriber>> {
    return this.http.get<Paged<Subscriber>>(`${A}/newsletter`, { params: queryParams(query) });
  }
  exportSubscribers(status: SubscriberStatus | null): Observable<CsvExport> {
    return this.http
      .get(`${A}/newsletter/export.csv`, {
        params: queryParams({ status }),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((res) => ({
          blob: res.body ?? new Blob([]),
          filename: attachmentName(res, 'newsletter-subscribers.csv'),
          truncated: false,
        })),
      );
  }
  deleteSubscriber(id: Id): Observable<{ deleted: true }> {
    return this.http.delete<{ deleted: true }>(`${A}/newsletter/${enc(id)}`);
  }

  // ---------- account ----------
  changePassword(currentPassword: string, newPassword: string): Observable<{ ok: true }> {
    return this.http.patch<{ ok: true }>(`${A}/auth/password`, { currentPassword, newPassword });
  }
  sessions(): Observable<StaffSession[]> {
    return this.http.get<StaffSession[]>(`${A}/auth/sessions`);
  }
  endSession(id: Id): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${A}/auth/sessions/${enc(id)}`);
  }
  endOtherSessions(): Observable<{ ended: number }> {
    return this.http.delete<{ ended: number }>(`${A}/auth/sessions`);
  }

  // ---------- applications ----------
  anonymise(id: Id): Observable<{ anonymized: true; reference: string }> {
    return this.http.delete<{ anonymized: true; reference: string }>(
      `${A}/applications/${enc(id)}`,
    );
  }
}
