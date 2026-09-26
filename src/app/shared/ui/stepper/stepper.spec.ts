import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { Stepper } from './stepper';

describe('Stepper', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: { ui: { stepper: { compact: 'الخطوة {{current}} من {{total}}', done: 'مكتملة' } } }, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
      providers: [{ provide: LocaleService, useValue: { lang: signal('ar'), intlLocale: signal('ar-SA-u-nu-arab') } }],
    });
  });

  async function render(current: number, completed: number[] | null = null) {
    const fixture = TestBed.createComponent(Stepper);
    fixture.componentRef.setInput('steps', [{ label: 'A' }, { label: 'B' }, { label: 'C' }]);
    fixture.componentRef.setInput('current', current);
    fixture.componentRef.setInput('completed', completed);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('marks done and current steps in the full stepper', async () => {
    const el = await render(1);
    const items = el.querySelectorAll('ol > li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('مكتملة');
    expect(items[0].querySelector('use')?.getAttribute('href')).toBe('/icons.svg#check');
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[2].getAttribute('aria-current')).toBeNull();
    expect(items[2].textContent).toContain('٣');
  });

  it('respects an explicit completed list', async () => {
    const el = await render(0, [2]);
    const items = el.querySelectorAll('ol > li');
    expect(items[2].querySelector('use')).not.toBeNull();
    expect(items[1].querySelector('use')).toBeNull();
  });

  it('renders the compact summary with localised digits and a progress bar', async () => {
    const el = await render(1);
    expect(el.textContent).toContain('الخطوة ٢ من ٣');
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('67');
  });
});
