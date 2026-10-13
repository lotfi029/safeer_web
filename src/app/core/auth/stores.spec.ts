import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { csrfInterceptor, problemDetailsInterceptor } from '../http/interceptors';
import { CsrfTokens } from './csrf-tokens';
import { ROLE_MATRIX } from './role-matrix';
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
  it('loads me + csrf token + role matrix from GET /admin/roles (B17)', async () => {
    const { ctrl, tokens } = setup();
    const store = TestBed.inject(StaffSessionStore);
    const loaded = store.ensureLoaded();
    ctrl.expectOne('/api/v1/admin/me').flush({
      id: '1',
      name: 'x',
      email: 'a@b.c',
      role: 'editor',
      isLocked: false,
      lastLoginAt: null,
      csrfToken: 't1',
    });
    await tick();
    ctrl.expectOne('/api/v1/admin/roles').flush({
      roles: ['admin', 'editor'],
      matrix: { content: ['admin', 'editor'], users: ['admin'] },
    });
    expect(await loaded).toBe(true);
    expect(tokens.staff()).toBe('t1');
    expect(store.can('content')).toBe(true);
    expect(store.can('users')).toBe(false);
    expect(store.can('inbox')).toBe(false);
  });

  it('falls back to the typed matrix when /admin/roles fails', async () => {
    const { ctrl } = setup();
    const store = TestBed.inject(StaffSessionStore);
    const loaded = store.ensureLoaded();
    ctrl.expectOne('/api/v1/admin/me').flush({
      id: '1',
      name: 'x',
      email: 'a@b.c',
      role: 'support',
      isLocked: false,
      lastLoginAt: null,
      csrfToken: 't',
    });
    await tick();
    ctrl.expectOne('/api/v1/admin/roles').flush({}, { status: 404, statusText: 'Not Found' });
    await loaded;
    expect(store.matrix()).toBe(ROLE_MATRIX);
    expect(store.can('inbox')).toBe(true);
    expect(store.can('content')).toBe(false);
    expect(store.can('settings')).toBe(false);
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
