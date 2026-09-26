import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { csrfInterceptor, problemDetailsInterceptor } from '../http/interceptors';
import { ApplicantSessionStore } from './applicant-session.store';
import { CsrfTokens } from './csrf-tokens';
import { ROLE_MATRIX } from './role-matrix';
import { StaffSessionStore } from './staff-session.store';

function setup() {
  TestBed.configureTestingModule({
    imports: [TranslocoTestingModule.forRoot({ langs: { ar: {}, en: {} }, translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' } })],
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
  it('loads me + csrf token + role matrix from GET /admin/roles (B17)', async () => {
    const { ctrl, tokens } = setup();
    const store = TestBed.inject(StaffSessionStore);
    const loaded = store.ensureLoaded();
    ctrl.expectOne('/api/v1/admin/me').flush({ id: '1', name: 'x', email: 'a@b.c', role: 'editor', isLocked: false, lastLoginAt: null, csrfToken: 't1' });
    await tick();
    ctrl.expectOne('/api/v1/admin/roles').flush({ roles: ['admin', 'editor'], matrix: { news: ['admin', 'editor'], users: ['admin'] } });
    expect(await loaded).toBe(true);
    expect(tokens.staff()).toBe('t1');
    expect(store.can('news')).toBe(true);
    expect(store.can('users')).toBe(false);
    expect(store.can('applications')).toBe(false);
  });

  it('falls back to the typed matrix when /admin/roles fails', async () => {
    const { ctrl } = setup();
    const store = TestBed.inject(StaffSessionStore);
    const loaded = store.ensureLoaded();
    ctrl.expectOne('/api/v1/admin/me').flush({ id: '1', name: 'x', email: 'a@b.c', role: 'reviewer', isLocked: false, lastLoginAt: null, csrfToken: 't' });
    await tick();
    ctrl.expectOne('/api/v1/admin/roles').flush({}, { status: 404, statusText: 'Not Found' });
    await loaded;
    expect(store.matrix()).toBe(ROLE_MATRIX);
    expect(store.can('applications')).toBe(true);
    expect(store.can('news')).toBe(false);
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

describe('ApplicantSessionStore', () => {
  it('keeps writes working after a reload: csrfToken comes from GET /portal/me (B16)', async () => {
    const { ctrl, tokens } = setup();
    const store = TestBed.inject(ApplicantSessionStore);
    const loaded = store.ensureLoaded();
    ctrl.expectOne('/api/v1/portal/me').flush({ reference: 'SA-2026-00001', status: 'draft', csrfToken: 'fresh' });
    expect(await loaded).toBe(true);
    expect(tokens.applicant()).toBe('fresh');
    expect(store.canWrite()).toBe(true);
  });

  it('reports canWrite=false when /portal/me has no csrfToken (B16 not live)', async () => {
    const { ctrl } = setup();
    const store = TestBed.inject(ApplicantSessionStore);
    const loaded = store.ensureLoaded();
    ctrl.expectOne('/api/v1/portal/me').flush({ reference: 'SA-2026-00001', status: 'draft' });
    await loaded;
    expect(store.isAuthenticated()).toBe(true);
    expect(store.canWrite()).toBe(false);
  });

  it('notifies clear listeners on logout', async () => {
    const { ctrl } = setup();
    const store = TestBed.inject(ApplicantSessionStore);
    const listener = vi.fn();
    store.onClear(listener);
    store.startSession('t');
    const done = store.logout();
    ctrl.expectOne('/api/v1/portal/auth/logout').flush({ ok: true });
    await done;
    expect(listener).toHaveBeenCalled();
    expect(store.status()).toBe('anonymous');
  });
});
