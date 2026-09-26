import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { toArabicDigits } from '../../pipes/format';
import { motionAllowed } from '../reveal/motion';

export interface ParsedStat {
  prefix: string;
  target: number;
  decimals: number;
  grouped: boolean;
  suffix: string;
}

const ARABIC_INDIC = /[٠-٩]/g;
const NUMERIC = /^(.*?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(.*)$/s;

/** Splits an API stat value ("2", "500+", "~1,200") into prefix / number / suffix. */
export function parseStat(value: string): ParsedStat | null {
  const latin = value.replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660));
  const m = NUMERIC.exec(latin);
  if (!m) {
    return null;
  }
  const [, prefix, int, frac = '', suffix] = m;
  return {
    prefix,
    target: Number(`${int.replace(/,/g, '')}${frac ? `.${frac}` : ''}`),
    decimals: frac.length,
    grouped: int.includes(','),
    suffix,
  };
}

export function formatStat(p: ParsedStat, n: number): string {
  const num = p.grouped
    ? n.toLocaleString('en-US', {
        minimumFractionDigits: p.decimals,
        maximumFractionDigits: p.decimals,
      })
    : n.toFixed(p.decimals);
  return `${p.prefix}${num}${p.suffix}`;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Stat counter (spec §2: counts up over 1.6s when it enters the viewport).
 *
 * The server and the first client render show the FINAL value, so SSR/no-JS/reduced-motion
 * visitors always get the real number. Screen readers read only the final value (visually hidden
 * copy); the animated digits are `aria-hidden`, and there is no live region.
 * `null` renders the missing-value placeholder `[—]` (no invented numbers).
 */
@Component({
  selector: 'app-counter',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block tabular-nums' },
  template: `
    @if (parsed() || value()) {
      <span class="sr-only">{{ finalText() }}</span>
      <span aria-hidden="true">{{ shownText() }}</span>
    } @else {
      {{ 'common.missingValue' | transloco }}
    }
  `,
})
export class Counter {
  /** API stat value, e.g. "2", "500+"; null when not published yet. */
  readonly value = input<string | null>(null);
  /** Animation length in ms (spec: 1.6s). */
  readonly duration = input(1600);

  private readonly locale = inject(LocaleService);
  /** Intermediate animated number; null = show the final value. */
  private readonly current = signal<number | null>(null);

  protected readonly parsed = computed(() => {
    const v = this.value();
    return v == null || v === '' ? null : parseStat(v);
  });

  protected readonly finalText = computed(() => this.localise(this.value() ?? ''));

  protected readonly shownText = computed(() => {
    const p = this.parsed();
    const n = this.current();
    return p && n !== null ? this.localise(formatStat(p, n)) : this.finalText();
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const win = inject(DOCUMENT).defaultView;
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    let frame = 0;
    let observer: IntersectionObserver | null = null;

    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
      if (frame && win) {
        win.cancelAnimationFrame(frame);
      }
    });

    afterNextRender(() => {
      if (!isBrowser || !win || !motionAllowed(win) || !this.parsed()?.target) {
        return;
      }
      observer = new win.IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) {
          return;
        }
        observer?.disconnect();
        let start: number | null = null;
        const step = (now: number) => {
          const p = this.parsed();
          start ??= now;
          const t = Math.min(1, (now - start) / Math.max(1, this.duration()));
          if (!p || t >= 1) {
            frame = 0;
            this.current.set(null);
            return;
          }
          const factor = 10 ** p.decimals;
          this.current.set(Math.round(p.target * easeOutCubic(t) * factor) / factor);
          frame = win.requestAnimationFrame(step);
        };
        this.current.set(0);
        frame = win.requestAnimationFrame(step);
      });
      observer.observe(host);
    });
  }

  private localise(text: string): string {
    return this.locale.lang() === 'ar' ? toArabicDigits(text) : text;
  }
}
