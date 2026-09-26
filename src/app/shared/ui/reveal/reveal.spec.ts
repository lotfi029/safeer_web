import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Reveal } from './reveal';
import { motionAllowed } from './motion';

@Component({
  imports: [Reveal],
  template: `<div appReveal [revealIndex]="index">content</div>`,
})
class Host {
  index = 2;
}

type IoCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

class FakeObserver {
  static last: FakeObserver | null = null;
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: IoCallback) {
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
}

function mockMatchMedia(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({ matches: reduce && query.includes('reduce'), media: query }) as MediaQueryList,
  );
}

async function render(platform = 'browser') {
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [{ provide: PLATFORM_ID, useValue: platform }],
  });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, el: (fixture.nativeElement as HTMLElement).querySelector('div')! };
}

describe('Reveal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeObserver.last = null;
  });

  it('sets the stagger delay from the index', async () => {
    const { el } = await render();
    expect(el.style.getPropertyValue('--reveal-delay')).toContain('* 2');
  });

  it('never hides content when IntersectionObserver is unavailable (SSR-safe default)', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { el } = await render();
    expect(el.classList.contains('reveal-init')).toBe(false);
  });

  it('never hides content on the server platform', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockMatchMedia(false);
    const { el } = await render('server');
    expect(el.classList.contains('reveal-init')).toBe(false);
  });

  it('does nothing under prefers-reduced-motion', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockMatchMedia(true);
    const { el } = await render();
    expect(el.classList.contains('reveal-init')).toBe(false);
    expect(FakeObserver.last).toBeNull();
  });

  it('leaves above-the-fold content alone', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockMatchMedia(false);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      bottom: 100,
    } as DOMRect);
    const { el } = await render();
    expect(el.classList.contains('reveal-init')).toBe(false);
    vi.restoreAllMocks();
  });

  it('hides below-the-fold content, then reveals it on intersect and unobserves', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockMatchMedia(false);
    const { el, fixture } = await render();
    expect(el.classList.contains('reveal-init')).toBe(true);
    const io = FakeObserver.last!;
    expect(io.observed).toContain(el);

    io.callback([{ isIntersecting: true }]);
    expect(el.classList.contains('reveal-in')).toBe(true);
    expect(el.classList.contains('reveal-init')).toBe(false);
    expect(io.disconnected).toBe(true);
    fixture.destroy();
  });

  it('disconnects on destroy', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockMatchMedia(false);
    const { fixture } = await render();
    fixture.destroy();
    expect(FakeObserver.last!.disconnected).toBe(true);
  });

  it('motionAllowed is false without a window', () => {
    expect(motionAllowed(null)).toBe(false);
  });
});
