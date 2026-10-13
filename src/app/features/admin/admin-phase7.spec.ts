import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { StaffSessionStore } from '../../core/auth/staff-session.store';
import { ROLE_MATRIX } from '../../core/auth/role-matrix';
import type { StaffRole } from '../../core/api/models';
import { AdminStrings } from '../../core/i18n/admin-strings';
import { LocaleService } from '../../core/i18n/locale.service';
import { ar as adminAr } from '../../core/i18n/translations/admin/ar';
import { en as adminEn } from '../../core/i18n/translations/admin/en';
import { loginErrorKey } from './auth/admin-login';
import { AdminBadges } from './layout/admin-badges';
import { AdminNav } from './layout/admin-nav';
import { messageStatusParam } from './messages/messages';

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
    const content = [
      'pages',
      'news',
      'workAreas',
      'board',
      'orgChart',
      'partners',
      'documents',
      'licences',
      'stats',
      'aboutItems',
      'media',
    ];
    const withTestimonials = [...content.slice(0, 5), 'testimonials', ...content.slice(5)];
    expect(labels('admin')).toEqual([
      'overview',
      'messages',
      'newsletter',
      ...withTestimonials,
      'redirects',
      'users',
      'settings',
      'mail',
      'audit',
    ]);
    TestBed.resetTestingModule();
    expect(labels('support')).toEqual(['overview', 'messages', 'newsletter', 'testimonials']);
    TestBed.resetTestingModule();
    expect(labels('editor')).toEqual(['overview', ...content, 'redirects']);
  });

  it('links carry the locale and badges come from the overview counts', () => {
    const nav = navFor('admin', { unreadMessages: 3 });
    const items = nav.groups()[0].items;
    expect(items.find((i) => i.label === 'messages')).toMatchObject({
      link: '/ar/admin/messages',
      count: 3,
    });
    expect(items.find((i) => i.label === 'newsletter')?.count).toBe(0);
    expect(items[0].link).toBe('/ar/admin');
  });
});

describe('login errors', () => {
  it('one message for every 401 (wrong password, disabled, locked); its own for 429', () => {
    expect(loginErrorKey(401, 'UNAUTHENTICATED')).toBe('admin.login.invalid');
    expect(loginErrorKey(429, 'RATE_LIMITED')).toBe('admin.login.rateLimited');
    expect(loginErrorKey(0, 'NETWORK')).toBe('errors.network');
  });
});

describe('messages helpers', () => {
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
