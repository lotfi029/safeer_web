import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { documentUrl } from '../../core/api/admin/admin-api';
import { StaffSessionStore } from '../../core/auth/staff-session.store';
import { ROLE_MATRIX } from '../../core/auth/role-matrix';
import type { StaffRole } from '../../core/api/models';
import { AdminStrings } from '../../core/i18n/admin-strings';
import { LocaleService } from '../../core/i18n/locale.service';
import { ar as adminAr } from '../../core/i18n/translations/admin/ar';
import { en as adminEn } from '../../core/i18n/translations/admin/en';
import { decisionActions, eventLine } from './applications/application-review';
import { fullName, listQuery, PAGE_SIZE } from './applications/applications-list';
import { canRequestDocuments, canReviewDocuments, nextStatuses } from './applications/transitions';
import { loginErrorKey } from './auth/admin-login';
import { AdminBadges } from './layout/admin-badges';
import { AdminNav } from './layout/admin-nav';
import { messageStatusParam } from './messages/messages';
import { monthLabel } from './overview/series-chart';

function navFor(role: StaffRole, badges: Record<string, number> = {}) {
  const me = signal({ role });
  const store = {
    role: () => me().role,
    matrix: () => ROLE_MATRIX,
    can: (area: keyof typeof ROLE_MATRIX) => ROLE_MATRIX[area].includes(me().role),
  };
  TestBed.configureTestingModule({
    imports: [TranslocoTestingModule.forRoot({ langs: { ar: {}, en: {} } })],
    providers: [
      { provide: StaffSessionStore, useValue: store },
      { provide: AdminBadges, useValue: { counts: signal(badges) } },
    ],
  });
  return TestBed.inject(AdminNav);
}

describe('admin shell menu (GET /admin/roles areas)', () => {
  const labels = (role: StaffRole) =>
    navFor(role)
      .groups()
      .flatMap((g) => g.items.map((i) => i.label));

  it('shows each role only the areas the matrix gives it', () => {
    expect(labels('admin')).toEqual(['overview', 'applications', 'messages']);
    TestBed.resetTestingModule();
    expect(labels('reviewer')).toEqual(['overview', 'applications']);
    TestBed.resetTestingModule();
    expect(labels('support')).toEqual(['overview', 'messages']);
    TestBed.resetTestingModule();
    expect(labels('editor')).toEqual(['overview']);
  });

  it('links carry the locale and badges come from the overview counts', () => {
    const nav = navFor('admin', { newApplications: 3, unreadMessages: 0 });
    const items = nav.groups()[0].items;
    expect(items.find((i) => i.label === 'applications')).toMatchObject({
      link: '/ar/admin/applications',
      count: 3,
    });
    expect(items.find((i) => i.label === 'messages')?.count).toBe(0);
    expect(items[0].link).toBe('/ar/admin');
  });
});

describe('application transitions', () => {
  it('offers the shared map as decisions, with accept/reject wording', () => {
    expect(decisionActions('under_review').map((a) => [a.to, a.labelKey])).toEqual([
      ['docs_missing', 'admin.review.status.moveTo'],
      ['interview', 'admin.review.status.moveTo'],
      ['accepted', 'admin.review.actions.accept'],
      ['rejected', 'admin.review.actions.reject'],
    ]);
    expect(decisionActions('accepted')).toEqual([]);
    expect(decisionActions('draft')).toEqual([]);
    expect(nextStatuses('docs_missing')).toEqual(['under_review']);
  });

  it('request documents and document review follow the API rules', () => {
    expect(
      ['new', 'under_review', 'interview'].map((s) => canRequestDocuments(s as never)),
    ).toEqual([true, true, true]);
    expect(canRequestDocuments('docs_missing')).toBe(false);
    expect(canReviewDocuments('draft')).toBe(false);
    expect(canReviewDocuments('rejected')).toBe(false);
    expect(canReviewDocuments('docs_missing')).toBe(true);
  });
});

describe('downloadPath rule (A11)', () => {
  it('links a current document through the API base and never a superseded one', () => {
    expect(documentUrl({ downloadPath: 'admin/applications/7/documents/9/file' })).toBe(
      '/api/v1/admin/applications/7/documents/9/file',
    );
    expect(documentUrl({ downloadPath: null })).toBeNull();
  });
});

describe('login errors', () => {
  it('one message for every 401 (wrong password, disabled, locked); its own for 429', () => {
    expect(loginErrorKey(401, 'UNAUTHENTICATED')).toBe('admin.login.invalid');
    expect(loginErrorKey(429, 'RATE_LIMITED')).toBe('admin.login.rateLimited');
    expect(loginErrorKey(0, 'NETWORK')).toBe('errors.network');
  });
});

describe('applications list query', () => {
  it('reads the URL, ignoring unknown statuses and bad pages', () => {
    expect(listQuery({ status: 'interview', q: '  SA-2026 ', reviewer: '4', page: 3 })).toEqual({
      status: 'interview',
      q: 'SA-2026',
      reviewerId: '4',
      page: 3,
      limit: PAGE_SIZE,
    });
    expect(listQuery({ status: 'bogus', q: '', page: 0 })).toMatchObject({
      status: null,
      q: null,
      page: 1,
    });
    expect(fullName({ firstName: 'A', middleName: null, lastName: 'B' })).toBe('A B');
  });
});

describe('activity log lines', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    `${key}${params ? JSON.stringify(params) : ''}`;

  it('describes status changes and document events with their data', () => {
    expect(eventLine({ type: 'STATUS_CHANGED', data: { from: 'new', to: 'accepted' } }, t)).toBe(
      'admin.review.log.events.STATUS_CHANGED{"to":"status.accepted"}',
    );
    expect(eventLine({ type: 'DOCUMENT_REJECTED', data: { docType: 'id_copy' } }, t)).toBe(
      'admin.review.log.events.DOCUMENT_REJECTED{"type":"docType.id_copy"}',
    );
    expect(eventLine({ type: 'DOCS_REQUESTED', data: { docTypes: ['id_copy', 'other'] } }, t)).toBe(
      'admin.review.log.events.DOCS_REQUESTED{"types":"docType.id_copy، docType.other"}',
    );
    expect(eventLine({ type: 'SOMETHING_NEW', data: null }, t)).toBe(
      'admin.review.log.events.other{"type":"SOMETHING_NEW"}',
    );
  });
});

describe('overview chart and messages helpers', () => {
  it('labels months in the Gregorian calendar', () => {
    expect(monthLabel('2026-09', 'en-GB')).toBe('Sept');
    expect(monthLabel('bad', 'en-GB')).toBe('bad');
  });

  it('keeps only known message filters', () => {
    expect(messageStatusParam('archived')).toBe('archived');
    expect(messageStatusParam('spam')).toBeNull();
    expect(messageStatusParam(null)).toBeNull();
  });
});

describe('admin strings', () => {
  it('ar and en have the same keys', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' ? keys(v as object, `${p}${k}.`) : [`${p}${k}`],
      );
    expect(keys(adminEn).sort()).toEqual(keys(adminAr).sort());
  });

  it('are merged under admin.* for the current locale only when an admin route opens', async () => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: { admin: { login: { title: 'دخول' } } }, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
    });
    await TestBed.inject(LocaleService).use('ar');
    const t = TestBed.inject(TranslocoService);
    expect(t.translate('admin.overview.title')).toBe('admin.overview.title');
    await TestBed.inject(AdminStrings).load('ar');
    expect(t.translate('admin.overview.title')).toBe('نظرة عامة');
    // The base dictionary's admin keys survive the merge.
    expect(t.translate('admin.login.title')).toBe('دخول');
  });
});
