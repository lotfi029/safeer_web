import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/problem';
import { CsrfTokens } from '../auth/csrf-tokens';
import { LocaleService } from '../i18n/locale.service';
import { credentialsInterceptor, csrfInterceptor, localeInterceptor, problemDetailsInterceptor } from './interceptors';

describe('API interceptor pipeline', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let tokens: CsrfTokens;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { ar: {}, en: {} }, translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' } })],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([localeInterceptor, credentialsInterceptor, csrfInterceptor, problemDetailsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(CsrfTokens);
    await TestBed.inject(LocaleService).use('en');
  });

  afterEach(() => ctrl.verify());

  it('adds ?lang and Accept-Language to public calls, not to admin calls', () => {
    http.get('/api/v1/home').subscribe();
    const pub = ctrl.expectOne((r) => r.url === '/api/v1/home');
    expect(pub.request.params.get('lang')).toBe('en');
    expect(pub.request.headers.get('Accept-Language')).toBe('en');
    expect(pub.request.withCredentials).toBe(false);
    pub.flush({});

    http.get('/api/v1/admin/me').subscribe();
    const admin = ctrl.expectOne('/api/v1/admin/me');
    expect(admin.request.params.has('lang')).toBe(false);
    expect(admin.request.withCredentials).toBe(true);
    admin.flush({});
  });

  it('does not override an explicit lang param', () => {
    http.get('/api/v1/news', { params: { lang: 'ar' } }).subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/v1/news');
    expect(req.request.params.get('lang')).toBe('ar');
    req.flush({});
  });

  it('sends X-CSRF-Token from the matching session on non-GET only', () => {
    tokens.staff.set('staff-token');
    tokens.applicant.set('app-token');

    http.post('/api/v1/admin/auth/logout', {}).subscribe();
    expect(ctrl.expectOne('/api/v1/admin/auth/logout').request.headers.get('X-CSRF-Token')).toBe('staff-token');

    http.patch('/api/v1/portal/application', {}).subscribe();
    expect(ctrl.expectOne((r) => r.url === '/api/v1/portal/application').request.headers.get('X-CSRF-Token')).toBe('app-token');

    http.get('/api/v1/portal/me').subscribe();
    expect(ctrl.expectOne((r) => r.url === '/api/v1/portal/me').request.headers.has('X-CSRF-Token')).toBe(false);

    http.post('/api/v1/contact', {}).subscribe();
    const contact = ctrl.expectOne((r) => r.url === '/api/v1/contact');
    expect(contact.request.headers.has('X-CSRF-Token')).toBe(false);
    expect(contact.request.withCredentials).toBe(false);
  });

  it('sends credentials on POST /applications (starts the applicant session)', () => {
    http.post('/api/v1/applications', {}).subscribe();
    expect(ctrl.expectOne((r) => r.url === '/api/v1/applications').request.withCredentials).toBe(true);
  });

  it('turns failures into ApiError', async () => {
    const promise = firstValueFrom(http.get('/api/v1/news'));
    ctrl.expectOne((r) => r.url === '/api/v1/news').flush(
      { code: 'RATE_LIMITED', title: 'x', status: 429 },
      { status: 429, statusText: 'Too Many Requests' },
    );
    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });

  it('a 401 inside the portal clears the session and redirects to the portal login', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    tokens.applicant.set('app-token');
    const promise = firstValueFrom(http.get('/api/v1/portal/documents'));
    ctrl.expectOne((r) => r.url === '/api/v1/portal/documents').flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'x' });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(tokens.applicant()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/en/portal/login'], expect.objectContaining({ queryParams: expect.any(Object) }));
  });

  it('a 401 from /portal/me is an answer, not an expiry', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    const promise = firstValueFrom(http.get('/api/v1/portal/me'));
    ctrl.expectOne((r) => r.url === '/api/v1/portal/me').flush({}, { status: 401, statusText: 'x' });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(navigate).not.toHaveBeenCalled();
  });
});
