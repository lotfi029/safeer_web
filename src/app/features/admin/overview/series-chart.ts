import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { DigitsPipe } from '../../../shared/pipes/format';

export interface SeriesPoint {
  month: string;
  received: number;
  accepted: number;
}

const W = 600;
const H = 220;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;
const BAR = 22;
const GAP = 6;

/** Month label from `YYYY-MM` (Gregorian, short month; Arabic month names in Arabic). */
export function monthLabel(month: string, intlLocale: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat(intlLocale, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/**
 * The overview's six-month chart (prototype `.bars`): received vs accepted per month as grouped bars
 * in an SVG. Months run with the reading direction (right to left in Arabic). The same figures are
 * in a visually hidden table for screen readers.
 */
@Component({
  selector: 'app-series-chart',
  imports: [TranslocoPipe, DigitsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="m-0 flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <figcaption class="t-h4 m-0 text-heading" id="series-title">
          {{ 'admin.overview.chart.title' | transloco }}
        </figcaption>
        <ul class="t-small m-0 flex list-none gap-4 p-0 text-text-muted" aria-hidden="true">
          <li class="flex items-center gap-2">
            <i class="block size-3 rounded-sm bg-primary"></i
            >{{ 'admin.overview.chart.received' | transloco }}
          </li>
          <li class="flex items-center gap-2">
            <i class="block size-3 rounded-sm bg-secondary"></i
            >{{ 'admin.overview.chart.accepted' | transloco }}
          </li>
        </ul>
      </div>
      <svg
        [attr.viewBox]="'0 0 ' + w + ' ' + (h + 28)"
        class="block h-auto w-full"
        role="img"
        aria-labelledby="series-title"
        data-testid="series-chart"
      >
        <line [attr.x1]="0" [attr.x2]="w" [attr.y1]="h" [attr.y2]="h" class="stroke-border" />
        @for (bar of bars(); track bar.month) {
          <g>
            <rect
              [attr.x]="bar.x"
              [attr.y]="bar.yReceived"
              [attr.width]="barWidth"
              [attr.height]="bar.hReceived"
              rx="4"
              class="fill-primary"
            >
              <title>{{ bar.label }}: {{ bar.received | digits }}</title>
            </rect>
            <rect
              [attr.x]="bar.x + barWidth + gap"
              [attr.y]="bar.yAccepted"
              [attr.width]="barWidth"
              [attr.height]="bar.hAccepted"
              rx="4"
              class="fill-secondary"
            >
              <title>{{ bar.label }}: {{ bar.accepted | digits }}</title>
            </rect>
            <text
              [attr.x]="bar.x + barWidth + gap / 2"
              [attr.y]="h + 22"
              text-anchor="middle"
              class="fill-text-muted text-[13px]"
            >
              {{ bar.label }}
            </text>
          </g>
        }
      </svg>
      <table class="sr-only">
        <caption>
          {{
            'admin.overview.chart.caption' | transloco
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ 'admin.overview.chart.month' | transloco }}</th>
            <th scope="col">{{ 'admin.overview.chart.received' | transloco }}</th>
            <th scope="col">{{ 'admin.overview.chart.accepted' | transloco }}</th>
          </tr>
        </thead>
        <tbody>
          @for (bar of bars(); track bar.month) {
            <tr>
              <th scope="row">{{ bar.label }}</th>
              <td>{{ bar.received | digits }}</td>
              <td>{{ bar.accepted | digits }}</td>
            </tr>
          }
        </tbody>
      </table>
    </figure>
  `,
})
export class SeriesChart {
  private readonly locale = inject(LocaleService);
  readonly series = input.required<readonly SeriesPoint[]>();

  protected readonly w = W;
  protected readonly h = H;
  protected readonly barWidth = BAR;
  protected readonly gap = GAP;

  protected readonly bars = computed(() => {
    const points = this.series();
    const max = Math.max(1, ...points.map((p) => Math.max(p.received, p.accepted)));
    const usable = H - PAD_TOP - PAD_BOTTOM;
    const slot = W / Math.max(1, points.length);
    const rtl = this.locale.dir() === 'rtl';
    return points.map((p, i) => {
      const index = rtl ? points.length - 1 - i : i;
      const x = index * slot + (slot - (BAR * 2 + GAP)) / 2;
      const hReceived = Math.round((p.received / max) * usable);
      const hAccepted = Math.round((p.accepted / max) * usable);
      return {
        ...p,
        label: monthLabel(p.month, this.locale.intlLocale()),
        x,
        hReceived,
        hAccepted,
        yReceived: H - hReceived,
        yAccepted: H - hAccepted,
      };
    });
  });
}
