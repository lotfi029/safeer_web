import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ToastOutlet, ToastService } from './toast';

const transloco = TranslocoTestingModule.forRoot({
  langs: { ar: {}, en: {} },
  translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
});

describe('ToastService', () => {
  afterEach(() => vi.useRealTimers());

  it('adds, auto-dismisses in the browser and dismisses by id', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ToastService);
    const a = service.show({ message: 'a', duration: 1000 });
    const b = service.error('b', 0);
    expect(service.toasts().map((t) => t.kind)).toEqual(['info', 'error']);
    vi.advanceTimersByTime(1000);
    expect(service.toasts().map((t) => t.id)).toEqual([b]);
    service.dismiss(b);
    expect(service.toasts()).toEqual([]);
    expect(a).not.toBe(b);
  });

  it('never starts timers on the server', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const service = TestBed.inject(ToastService);
    service.success('x', 10);
    expect(vi.getTimerCount()).toBe(0);
    expect(service.toasts().length).toBe(1);
  });
});

describe('ToastOutlet', () => {
  it('routes info/success to the polite region and errors to the alert region', async () => {
    TestBed.configureTestingModule({ imports: [transloco] });
    const fixture = TestBed.createComponent(ToastOutlet);
    const service = TestBed.inject(ToastService);
    service.info('info msg', 0);
    service.success('ok msg', 0);
    service.error('err msg', 0);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const polite = el.querySelector('[role="status"]') as HTMLElement;
    const alert = el.querySelector('[role="alert"]') as HTMLElement;
    expect(polite.getAttribute('aria-live')).toBe('polite');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(polite.textContent).toContain('info msg');
    expect(polite.textContent).toContain('ok msg');
    expect(alert.textContent).toContain('err msg');
    expect(polite.textContent).not.toContain('err msg');

    const dismiss = alert.querySelector('button') as HTMLButtonElement;
    expect(dismiss.getAttribute('aria-label')).toBe('ui.toast.dismiss');
    dismiss.click();
    await fixture.whenStable();
    expect(alert.textContent).not.toContain('err msg');
    expect(service.toasts().length).toBe(2);
    service.clear();
  });
});
