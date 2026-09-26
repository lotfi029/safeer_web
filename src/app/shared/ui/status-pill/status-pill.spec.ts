import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { APPLICATION_STATUSES, ApplicationStatus } from '../../../core/api/models';
import { APPLICATION_STATUS_VARIANT, DocStatusPill, Pill, StatusPill } from './status-pill';

@Component({
  imports: [Pill],
  template: `<app-pill variant="solid">X</app-pill>`,
})
class Host {}

describe('status pills', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: { status: { accepted: 'مقبول' } }, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
    });
  });

  it('maps every application status to a variant', () => {
    for (const s of APPLICATION_STATUSES) {
      expect(APPLICATION_STATUS_VARIANT[s]).toBeTruthy();
    }
  });

  const cases: [ApplicationStatus, string | null][] = [
    ['draft', 'pill-plain'],
    ['new', null],
    ['docs_missing', 'pill-warn'],
    ['interview', 'pill-solid'],
    ['accepted', 'pill-ok'],
    ['rejected', 'pill-warn'],
  ];
  for (const [status, cls] of cases) {
    it(`renders ${status}`, async () => {
      const fixture = TestBed.createComponent(StatusPill);
      fixture.componentRef.setInput('status', status);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList).toContain('pill');
      if (cls) {
        expect(host.classList).toContain(cls);
      } else {
        expect(host.className).not.toMatch(/pill-/);
      }
    });
  }

  it('translates the label', async () => {
    const fixture = TestBed.createComponent(StatusPill);
    fixture.componentRef.setInput('status', 'accepted');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('مقبول');
  });

  it('renders document statuses', async () => {
    const fixture = TestBed.createComponent(DocStatusPill);
    fixture.componentRef.setInput('status', 'rejected');
    await fixture.whenStable();
    expect(fixture.nativeElement.classList).toContain('pill-warn');
    fixture.componentRef.setInput('status', 'missing');
    await fixture.whenStable();
    expect(fixture.nativeElement.classList).toContain('pill-plain');
  });

  it('renders the generic pill', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const pill = fixture.nativeElement.querySelector('app-pill') as HTMLElement;
    expect(pill.classList).toContain('pill-solid');
    expect(pill.textContent).toBe('X');
  });
});
