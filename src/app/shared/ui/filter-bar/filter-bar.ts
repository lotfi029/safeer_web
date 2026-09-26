import type { DialogRef } from '@angular/cdk/dialog';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  output,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '../button/button';
import { DrawerFrame, DrawerService } from '../drawer/drawer';
import { Icon } from '../icon/icon';

export interface FilterChip {
  /** `null` = "all" (removes the query param in link mode). */
  value: string | null;
  label: string;
}

let nextId = 0;

/**
 * Chip filters + optional search. On `sm`+ the chips sit in a row that scrolls on its own; below
 * `sm` they move into a bottom sheet behind a "Filters" button. `linkMode` renders the chips as
 * real links with `?<queryParamName>=value` (crawlable filters for SSR pages).
 */
@Component({
  selector: 'app-filter-bar',
  imports: [NgTemplateOutlet, RouterLink, TranslocoPipe, Button, DrawerFrame, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 sm:flex-row sm:items-center' },
  template: `
    @if (showSearch()) {
      <label class="relative block sm:w-72 sm:shrink-0">
        <span class="sr-only">{{ searchLabel() || ('ui.filterBar.searchLabel' | transloco) }}</span>
        <app-icon
          name="search"
          class="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-decor"
        />
        <!-- Plain .control, not appControl: outside <app-field> that directive binds id="null". -->
        <input
          type="search"
          class="control ps-12"
          [id]="searchId"
          [value]="searchValue()"
          [attr.placeholder]="placeholder() || null"
          (input)="onSearchInput($event)"
          (keydown.enter)="flushSearch()"
        />
      </label>
    }

    @if (chips().length) {
      <!-- sm+: one row that scrolls horizontally inside itself. -->
      <div
        class="-my-1 hidden min-w-0 flex-1 gap-2 overflow-x-auto py-1 sm:flex"
        role="group"
        [attr.aria-label]="label() || ('common.filters' | transloco)"
      >
        <ng-container *ngTemplateOutlet="chipList; context: { sheet: false }" />
      </div>

      <!-- < sm: chips in a bottom sheet. -->
      <button
        appButton
        variant="line"
        size="sm"
        type="button"
        class="justify-between sm:hidden"
        aria-haspopup="dialog"
        (click)="openSheet()"
      >
        <span class="inline-flex items-center gap-2">
          <app-icon name="sliders-horizontal" />
          {{ 'ui.filterBar.open' | transloco }}
        </span>
        @if (selectedLabel(); as current) {
          <span class="pill">{{ current }}</span>
        }
      </button>
    }

    <ng-template #chipList let-inSheet="sheet">
      @for (chip of chips(); track chip.value) {
        @if (linkMode()) {
          <a
            class="chip shrink-0"
            [routerLink]="[]"
            [queryParams]="params(chip.value)"
            queryParamsHandling="merge"
            [attr.aria-current]="isSelected(chip) ? 'page' : null"
            (click)="pick(chip, inSheet)"
            >{{ chip.label }}</a
          >
        } @else {
          <button
            type="button"
            class="chip shrink-0"
            [attr.aria-pressed]="isSelected(chip)"
            (click)="pick(chip, inSheet)"
          >
            {{ chip.label }}
          </button>
        }
      }
    </ng-template>

    <ng-template #sheet>
      <app-drawer-frame
        [heading]="label() || ('common.filters' | transloco)"
        [headingId]="sheetHeadingId"
      >
        <div class="flex flex-wrap gap-2" role="group" [attr.aria-labelledby]="sheetHeadingId">
          <ng-container *ngTemplateOutlet="chipList; context: { sheet: true }" />
        </div>
        @if (!linkMode()) {
          <button drawerActions appButton [block]="true" type="button" (click)="closeSheet()">
            {{ 'ui.filterBar.apply' | transloco }}
          </button>
        }
      </app-drawer-frame>
    </ng-template>
  `,
})
export class FilterBar {
  private readonly drawer = inject(DrawerService);

  readonly chips = input<readonly FilterChip[]>([]);
  readonly selected = model<string | null>(null);
  readonly searchValue = model('');
  /** Visually hidden label of the search input; default `ui.filterBar.searchLabel`. */
  readonly searchLabel = input('');
  readonly placeholder = input('');
  /** Accessible name of the chip group / sheet title; default `common.filters`. */
  readonly label = input('');
  readonly showSearch = input(true);
  readonly debounceMs = input(300);
  readonly linkMode = input(false);
  readonly queryParamName = input('filter');
  /** Query params cleared when a filter link changes (e.g. back to page 1). */
  readonly resetQueryParams = input<readonly string[]>(['page']);

  /** Debounced search text (also emitted immediately on Enter). */
  readonly searchChange = output<string>();

  protected readonly searchId = `app-filter-search-${++nextId}`;
  protected readonly sheetHeadingId = `${this.searchId}-sheet`;
  protected readonly selectedLabel = computed(() => {
    const chip = this.chips().find((c) => c.value === this.selected());
    return chip && chip.value !== null ? chip.label : null;
  });

  private readonly sheetTpl = viewChild.required<TemplateRef<unknown>>('sheet');
  private sheetRef: DialogRef<unknown, unknown> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.sheetRef?.close();
    });
  }

  protected isSelected(chip: FilterChip): boolean {
    return chip.value === this.selected();
  }

  protected params(value: string | null): Record<string, string | null> {
    const params: Record<string, string | null> = {};
    for (const name of this.resetQueryParams()) {
      params[name] = null;
    }
    params[this.queryParamName()] = value;
    return params;
  }

  protected pick(chip: FilterChip, fromSheet: boolean): void {
    this.selected.set(chip.value);
    if (fromSheet && this.linkMode()) {
      this.closeSheet();
    }
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchValue.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.searchChange.emit(value), this.debounceMs());
  }

  protected flushSearch(): void {
    clearTimeout(this.timer);
    this.searchChange.emit(this.searchValue());
  }

  openSheet(): void {
    this.sheetRef = this.drawer.open(this.sheetTpl(), {
      side: 'bottom',
      ariaLabelledBy: this.sheetHeadingId,
    });
    this.sheetRef.closed.subscribe(() => (this.sheetRef = null));
  }

  closeSheet(): void {
    this.sheetRef?.close();
  }
}
