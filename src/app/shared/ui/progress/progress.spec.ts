import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { clampPercent, Progress } from './progress';

describe('Progress', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: {}, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
      providers: [{ provide: LocaleService, useValue: { lang: signal('en'), intlLocale: signal('en-GB') } }],
    });
  });

  it('clamps values', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(66.4)).toBe(66);
    expect(clampPercent(null)).toBe(0);
  });

  it('renders an accessible progressbar', async () => {
    const fixture = TestBed.createComponent(Progress);
    fixture.componentRef.setInput('value', 66);
    fixture.componentRef.setInput('label', 'Upload');
    fixture.componentRef.setInput('showValue', true);
    await fixture.whenStable();
    const bar = fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('66');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-label')).toBe('Upload');
    expect((bar.querySelector('span') as HTMLElement).style.inlineSize).toBe('66%');
    expect(fixture.nativeElement.textContent).toContain('ui.progress');
  });
});
