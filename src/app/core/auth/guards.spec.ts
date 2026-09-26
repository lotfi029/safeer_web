import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LocaleService } from '../i18n/locale.service';
import { ApplicantSessionStore } from './applicant-session.store';
import { applicantGuard, roleGuard, staffGuard } from './guards';
import { StaffSessionStore } from './staff-session.store';

@Component({ template: 'ok' })
class Page {}

describe('guards', () => {
  const staff = { ensureLoaded: vi.fn(), can: vi.fn() };
  const applicant = { ensureLoaded: vi.fn() };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { ar: {}, en: {} }, translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' } })],
      providers: [
        { provide: StaffSessionStore, useValue: staff },
        { provide: ApplicantSessionStore, useValue: applicant },
        provideRouter([
          { path: 'ar/admin', canActivate: [staffGuard], component: Page },
          { path: 'ar/admin/news', canActivate: [staffGuard, roleGuard], data: { area: 'news' }, component: Page },
          { path: 'ar/admin/login', component: Page },
          { path: 'ar/admin/forbidden', component: Page },
          { path: 'ar/portal', canActivate: [applicantGuard], component: Page },
          { path: 'ar/portal/login', component: Page },
        ]),
      ],
    });
    await TestBed.inject(LocaleService).use('ar');
  });

  it('staffGuard redirects anonymous users to login with returnUrl', async () => {
    staff.ensureLoaded.mockResolvedValue(false);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ar/admin');
    expect(TestBed.inject(Router).url).toBe('/ar/admin/login?returnUrl=%2Far%2Fadmin');
  });

  it('roleGuard sends users without the area to the no-access page', async () => {
    staff.ensureLoaded.mockResolvedValue(true);
    staff.can.mockReturnValue(false);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ar/admin/news');
    expect(TestBed.inject(Router).url).toBe('/ar/admin/forbidden');
    staff.can.mockReturnValue(true);
    await harness.navigateByUrl('/ar/admin/news');
    expect(TestBed.inject(Router).url).toBe('/ar/admin/news');
  });

  it('applicantGuard redirects to the portal login', async () => {
    applicant.ensureLoaded.mockResolvedValue(false);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ar/portal');
    expect(TestBed.inject(Router).url).toBe('/ar/portal/login?returnUrl=%2Far%2Fportal');
  });
});
