import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { csrfInterceptor, problemDetailsInterceptor } from '../http/interceptors';
import { CsrfTokens } from './csrf-tokens';
import { StaffSessionStore } from './staff-session.store';

function setup() {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { ar: {}, en: {} },
        translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
      }),
    ],
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([csrfInterceptor, problemDetailsInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return { ctrl: TestBed.inject(HttpTestingController), tokens: TestBed.inject(CsrfTokens) };
}

const tick = () => new Promise((r) => setTimeout(r));

describe('StaffSessionStore', () => {
  const me = (permissions: string[], extra: Record<string, unknown> = {}) => ({
    id: '1',
    name: 'x',
    email: 'a@b.c',
    role: { id: '2', key: 'editor', nameAr: 'محرر محتوى', nameEn: 'Editor' },
    isLocked: false,
    lastLoginAt: null,
    csrfToken: 't1',
    permissions,
    ...extra,
  });

  it('loads me, the csrf token and the role permissions from GET /admin/me (v1.1.0)', async () => {
    const { ctrl, tokens } = setup();
    const store = TestBed.inject(StaffSessionStore);
    const loaded = store.ensureLoaded();
    ctrl.expectOne('/api/v1/admin/me').flush(me(['news.view', 'news.manage', 'pages.view']));
    expect(await loaded).toBe(true);
    ctrl.verify(); // no second call: there is no matrix to fetch any more
    expect(tokens.staff()).toBe('t1');
    expect(store.role()?.key).toBe('editor');
    expect(store.can('news.manage')).toBe(true);
    expect(store.can('pages.view')).toBe(true);
    expect(store.can('news.delete')).toBe(false);
    expect(store.can('users.view')).toBe(false);
  });

  it('treats * as every permission', async () => {
    const { ctrl } = setup();
    const store = TestBed.inject(StaffSessionStore);
    const loaded = store.ensureLoaded();
    ctrl.expectOne('/api/v1/admin/me').flush(me(['*']));
    await loaded;
    expect(store.can('users.delete')).toBe(true);
    expect(store.can('audit.view')).toBe(true);
  });

  it('after login reads admin/me for the permissions; grants nothing if that read fails', async () => {
    const { ctrl } = setup();
    const store = TestBed.inject(StaffSessionStore);
    const done = store.login('a@b.c', 'pw');
    ctrl.expectOne('/api/v1/admin/auth/login').flush({ user: me([]), csrfToken: 't2' });
    await tick();
    ctrl.expectOne('/api/v1/admin/me').flush({}, { status: 500, statusText: 'x' });
    await done;
    expect(store.isAuthenticated()).toBe(true);
    expect(store.permissions().size).toBe(0);
    expect(store.can('news.view')).toBe(false);
  });

  it('is anonymous on 401 and shares one in-flight load', async () => {
    const { ctrl } = setup();
    const store = TestBed.inject(StaffSessionStore);
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();
    ctrl.expectOne('/api/v1/admin/me').flush({}, { status: 401, statusText: 'x' });
    expect(await a).toBe(false);
    expect(await b).toBe(false);
    expect(store.status()).toBe('anonymous');
  });
});
