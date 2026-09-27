import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Brand, Logo } from './logo';

describe('Logo / Brand', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: { common: { orgName: 'جمعية سفير الدعوية' } }, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
    });
  });

  it('renders the temporary PNG in a chip with the org name as alt', async () => {
    const fixture = TestBed.createComponent(Logo);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const img = host.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('/brand/safeer-logo-sm.png');
    expect(img.getAttribute('alt')).toBe('جمعية سفير الدعوية');
    expect(img.getAttribute('width')).toBe('73');
    expect(img.getAttribute('height')).toBe('112');
    expect(img.classList.contains('h-full')).toBe(true);
    expect(host.style.blockSize).toBe('48px');
  });

  it('accepts a custom height, alt and priority', async () => {
    const fixture = TestBed.createComponent(Logo);
    fixture.componentRef.setInput('height', 52);
    fixture.componentRef.setInput('alt', '');
    fixture.componentRef.setInput('priority', true);
    await fixture.whenStable();
    const img = (fixture.nativeElement as HTMLElement).querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('');
    expect((fixture.nativeElement as HTMLElement).style.blockSize).toBe('52px');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('brand shows name and tagline, compact hides the tagline', async () => {
    const fixture = TestBed.createComponent(Brand);
    fixture.componentRef.setInput('tagline', 'لطلاب المنح');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('جمعية سفير الدعوية');
    expect(el.textContent).toContain('لطلاب المنح');
    expect(el.querySelector('img')!.getAttribute('alt')).toBe('');

    fixture.componentRef.setInput('compact', true);
    fixture.componentRef.setInput('name', 'سفير');
    await fixture.whenStable();
    expect(el.textContent).not.toContain('لطلاب المنح');
    expect(el.textContent).toContain('سفير');
    expect(el.querySelector('app-logo')!.getAttribute('style')).toContain('42px');
  });
});
