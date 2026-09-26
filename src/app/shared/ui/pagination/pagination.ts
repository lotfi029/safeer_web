import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DigitsPipe } from '../../pipes/format';
import { Icon } from '../icon/icon';

export type PageItem = number | 'gap';

/**
 * Windowed page list: first, last, current ± `siblings`, with `'gap'` for skipped ranges.
 * A gap is only used when it hides at least two pages (otherwise the page itself is shown).
 */
export function pageWindow(current: number, count: number, siblings = 1): PageItem[] {
  if (count <= 0) {
    return [];
  }
  const page = Math.min(Math.max(current, 1), count);
  // first + last + current + 2×siblings + 2 gaps
  if (count <= 5 + siblings * 2) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  let start = Math.max(2, page - siblings);
  let end = Math.min(count - 1, page + siblings);
  // Keep the window the same width near the edges.
  if (page - siblings <= 3) {
    start = 2;
    end = 3 + siblings * 2;
  } else if (page + siblings >= count - 2) {
    start = count - 2 - siblings * 2;
    end = count - 1;
  }
  const items: PageItem[] = [1];
  if (start > 2) items.push('gap');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < count - 1) items.push('gap');
  items.push(count);
  return items;
}

/**
 * Crawlable pagination: every page is a real `<a>` to the current route with `?page=n` merged into
 * the existing query params (page 1 removes the param). Below `sm` only a "page x of y" summary and
 * prev/next are shown. Renders nothing when there is a single page.
 */
@Component({
  selector: 'app-pagination',
  imports: [RouterLink, TranslocoPipe, DigitsPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (pageCount() > 1) {
      <nav [attr.aria-label]="label() || ('ui.pagination.label' | transloco)">
        <ul class="flex items-center justify-center gap-2">
          <li>
            @if (current() > 1) {
              <a
                class="icon-btn"
                rel="prev"
                [routerLink]="[]"
                [queryParams]="params(current() - 1)"
                queryParamsHandling="merge"
                [attr.aria-label]="'ui.pagination.previous' | transloco"
              >
                <app-icon name="chevron-left" />
              </a>
            } @else {
              <span class="icon-btn cursor-not-allowed opacity-50" aria-disabled="true">
                <app-icon name="chevron-left" />
                <span class="sr-only">{{ 'ui.pagination.previous' | transloco }}</span>
              </span>
            }
          </li>

          <li class="px-2 t-small sm:hidden" aria-current="page">
            {{ 'ui.pagination.summary' | transloco: { page: (current() | digits), total: (pageCount() | digits) } }}
          </li>

          @for (item of items(); track $index) {
            <li class="hidden sm:block">
              @if (item === 'gap') {
                <span class="inline-flex h-11 min-w-8 items-center justify-center text-text-muted" aria-hidden="true">…</span>
              } @else if (item === current()) {
                <a
                  class="inline-flex h-11 min-w-11 items-center justify-center rounded-[var(--radius-btn)] bg-primary px-3 font-semibold text-on-primary"
                  [routerLink]="[]"
                  [queryParams]="params(item)"
                  queryParamsHandling="merge"
                  aria-current="page"
                  [attr.aria-label]="'ui.pagination.page' | transloco: { page: (item | digits) }"
                >{{ item | digits }}</a>
              } @else {
                <a
                  class="inline-flex h-11 min-w-11 items-center justify-center rounded-[var(--radius-btn)] border border-border bg-card px-3 text-text no-underline hover:bg-raise"
                  [routerLink]="[]"
                  [queryParams]="params(item)"
                  queryParamsHandling="merge"
                  [attr.aria-label]="'ui.pagination.page' | transloco: { page: (item | digits) }"
                >{{ item | digits }}</a>
              }
            </li>
          }

          <li>
            @if (current() < pageCount()) {
              <a
                class="icon-btn"
                rel="next"
                [routerLink]="[]"
                [queryParams]="params(current() + 1)"
                queryParamsHandling="merge"
                [attr.aria-label]="'ui.pagination.next' | transloco"
              >
                <app-icon name="chevron-right" />
              </a>
            } @else {
              <span class="icon-btn cursor-not-allowed opacity-50" aria-disabled="true">
                <app-icon name="chevron-right" />
                <span class="sr-only">{{ 'ui.pagination.next' | transloco }}</span>
              </span>
            }
          </li>
        </ul>
      </nav>
    }
  `,
})
export class Pagination {
  /** 1-based current page. */
  readonly page = input(1);
  /** Total number of items. */
  readonly total = input.required<number>();
  readonly pageSize = input(20);
  readonly queryParamName = input('page');
  /** Accessible name of the `<nav>`; default `ui.pagination.label`. */
  readonly label = input('');
  /** Pages shown on each side of the current one (sm+). */
  readonly siblings = input(1);

  readonly pageCount = computed(() => Math.max(0, Math.ceil(this.total() / Math.max(1, this.pageSize()))));
  readonly current = computed(() => Math.min(Math.max(1, this.page()), Math.max(1, this.pageCount())));
  readonly items = computed(() => pageWindow(this.current(), this.pageCount(), this.siblings()));

  protected params(page: number): Record<string, number | null> {
    return { [this.queryParamName()]: page <= 1 ? null : page };
  }
}
