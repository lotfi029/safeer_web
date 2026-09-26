import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { Counter, formatStat, parseStat } from './counter';

const lang = signal<'ar' | 'en'>('ar');

class FakeObserver {
  static last: FakeObserver | null = null;
  disconnected = false;
  constructor(readonly callback: (e: Partial<IntersectionObserverEntry>[]) => void) {
    FakeObserver.last = this;
  }
  observe() {
    /* noop */
  }
  disconnect() {
    this.disconnected = true;
  }
}

async function render(value: string | null, duration = 1600) {
  TestBed.configureTestingModule({
    imports: [
      Counter,
      TranslocoTestingModule.forRoot({
        langs: { ar: { common: { missingValue: '[—]' } }, en: {} },
        translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
      }),
    ],
    providers: [{ provide: LocaleService, useValue: { lang } }],
  });
  const fixture: ComponentFixture<Counter> = TestBed.createComponent(Counter);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('duration', duration);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    shown: () => el.querySelector('[aria-hidden="true"]')?.textContent?.trim(),
    sr: () => el.querySelector('.sr-only')?.textContent?.trim(),
  };
}

describe('parseStat / formatStat', () => {
  it('keeps prefix and suffix', () => {
    expect(parseStat('500+')).toEqual({ prefix: '', target: 500, decimals: 0, grouped: false, suffix: '+' });
    expect(parseStat('~1,200 طالب')?.target).toBe(1200);
    expect(parseStat('٢')?.target).toBe(2);
    expect(parseStat('—')).toBeNull();
    const p = parseStat('1,200+')!;
    expect(formatStat(p, 350)).toBe('350+');
    expect(formatStat(p, 1200)).toBe('1,200+');
  });
});

describe('Counter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeObserver.last = null;
    lang.set('ar');
  });

  it('renders the final value with Arabic-Indic digits (SSR default)', async () => {
    const { shown, sr } = await render('500+');
    expect(shown()).toBe('٥٠٠+');
    expect(sr()).toBe('٥٠٠+');
  });

  it('keeps Latin digits in English', async () => {
    lang.set('en');
    const { shown } = await render('2');
    expect(shown()).toBe('2');
  });

  it('renders the missing-value placeholder for null', async () => {
    const { el } = await render(null);
    expect(el.textContent?.trim()).toBe('[—]');
  });

  it('does not animate without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { shown } = await render('500+');
    expect(shown()).toBe('٥٠٠+');
  });

  it('does not animate under prefers-reduced-motion', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }) as MediaQueryList);
    const { shown } = await render('500+');
    expect(FakeObserver.last).toBeNull();
    expect(shown()).toBe('٥٠٠+');
  });

  it('counts up from 0 when it enters the viewport; screen readers only get the final value', async () => {
    lang.set('en');
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { fixture, shown, sr } = await render('500+', 1000);
    // Drains every queued frame (the zoneless scheduler may queue its own too).
    const tick = (now: number) => frames.splice(0).forEach((cb) => cb(now));

    FakeObserver.last!.callback([{ isIntersecting: true }]);
    expect(FakeObserver.last!.disconnected).toBe(true);
    fixture.detectChanges();
    expect(shown()).toBe('0+');

    tick(0);
    tick(500);
    fixture.detectChanges();
    const mid = Number(shown()!.replace('+', ''));
    expect(mid).toBeGreaterThan(250);
    expect(mid).toBeLessThan(500);
    expect(sr()).toBe('500+');

    tick(1000);
    fixture.detectChanges();
    expect(shown()).toBe('500+');
  });
});
