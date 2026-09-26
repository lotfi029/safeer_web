import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  Directive,
  inject,
  input,
  model,
  signal,
  TemplateRef,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DigitsPipe } from '../../pipes/format';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icon-names';

export interface DataTableCellContext<T> {
  $implicit: T;
}

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  /** Custom cell; otherwise `value(row)` or `row[key]` is printed. */
  cell?: TemplateRef<DataTableCellContext<T>>;
  /** Plain-text value (used for the default cell and the row checkbox's accessible name). */
  value?: (row: T) => string | number | null | undefined;
  /** Hide this column from the mobile card (the first column is always the card title). */
  hideOnMobile?: boolean;
  align?: 'start' | 'center' | 'end';
}

export interface DataTableSort {
  key: string;
  dir: 'asc' | 'desc';
}

/** Row actions: `<ng-template appDataTableActions let-row>…</ng-template>`. */
@Directive({ selector: 'ng-template[appDataTableActions]' })
export class DataTableActions {
  readonly template = inject<TemplateRef<DataTableCellContext<unknown>>>(TemplateRef);
}

/** Empty state: `<ng-template appDataTableEmpty>…</ng-template>`. */
@Directive({ selector: 'ng-template[appDataTableEmpty]' })
export class DataTableEmpty {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/** Cell template by column key: `<ng-template appDataTableCell="status" let-row>…</ng-template>`. */
@Directive({ selector: 'ng-template[appDataTableCell]' })
export class DataTableCell {
  readonly key = input.required<string>({ alias: 'appDataTableCell' });
  readonly template = inject<TemplateRef<DataTableCellContext<unknown>>>(TemplateRef);
}

const ALIGN = { start: 'text-start', center: 'text-center', end: 'text-end' } as const;

/**
 * Config-driven data table. `md`+ renders a semantic `<table>`; below `md` a list of cards (first
 * column = title, other columns as a `<dl>`). Both are rendered and toggled with CSS, so SSR output
 * is correct at every width. Sorting is reported through `sort` (the parent sorts/fetches).
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, TranslocoPipe, DigitsPipe, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3', '[attr.aria-busy]': 'loading() ? "true" : null' },
  template: `
    @if (selectable()) {
      <div class="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p class="t-small font-semibold text-heading" role="status">
          @if (selectedCount() > 0) {
            {{ 'ui.table.selected' | transloco: { count: (selectedCount() | digits) } }}
          }
        </p>
        @if (rows().length && !loading()) {
          <button
            appButton
            variant="line"
            size="sm"
            type="button"
            class="md:hidden"
            [attr.aria-pressed]="selectionMode()"
            (click)="toggleSelectionMode()"
          >
            <app-icon [name]="selectionMode() ? 'x' : 'square-check'" />
            {{
              (selectionMode() ? 'ui.table.exitSelection' : 'ui.table.selectionMode') | transloco
            }}
          </button>
        }
      </div>
    }

    @if (error() !== null) {
      <div class="note note-warn" role="alert">
        <app-icon name="circle-alert" />
        <p>{{ error() || ('ui.table.error' | transloco) }}</p>
      </div>
    } @else if (loading()) {
      <p class="sr-only">{{ 'common.loading' | transloco }}</p>
      <div class="card card-flush hidden md:block" aria-hidden="true">
        @for (i of skeletonRows; track i) {
          <div class="flex gap-6 border-b border-border px-4 py-4 last:border-b-0">
            @for (col of columns(); track col.key) {
              <span class="skeleton h-5 flex-1"></span>
            }
          </div>
        }
      </div>
      <div class="flex flex-col gap-3 md:hidden" aria-hidden="true">
        @for (i of skeletonRows.slice(0, 3); track i) {
          <div class="card flex flex-col gap-3 p-5">
            <span class="skeleton h-5 w-2/3"></span>
            <span class="skeleton h-4 w-full"></span>
            <span class="skeleton h-4 w-1/2"></span>
          </div>
        }
      </div>
    } @else if (!rows().length) {
      @if (emptyTpl(); as empty) {
        <ng-container [ngTemplateOutlet]="empty.template" />
      } @else {
        <div class="card flex flex-col items-center gap-3 text-center text-text-muted">
          <app-icon name="list" [size]="28" class="text-decor" />
          <p>{{ 'ui.table.empty' | transloco }}</p>
        </div>
      }
    } @else {
      <!-- md+: semantic table -->
      <div class="card card-flush hidden overflow-x-auto md:block">
        <table class="w-full border-collapse text-start">
          <caption class="sr-only">
            {{
              caption()
            }}
          </caption>
          <thead class="bg-surface">
            <tr>
              @if (selectable()) {
                <th scope="col" class="w-14 px-2">
                  <label class="inline-flex size-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      class="size-5 accent-primary"
                      [checked]="allSelected()"
                      [indeterminate]="someSelected()"
                      (change)="toggleAll()"
                    />
                    <span class="sr-only">{{ 'ui.table.selectAll' | transloco }}</span>
                  </label>
                </th>
              }
              @for (col of columns(); track col.key) {
                <th
                  scope="col"
                  class="t-small px-4 py-3 font-semibold whitespace-nowrap text-text-muted"
                  [class]="alignClass(col)"
                  [attr.aria-sort]="col.sortable ? ariaSort(col) : null"
                >
                  @if (col.sortable) {
                    <button
                      type="button"
                      class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold hover:text-heading"
                      (click)="toggleSort(col)"
                    >
                      {{ col.header }}
                      <app-icon [name]="sortIcon(col)" [size]="16" [directional]="false" />
                    </button>
                  } @else {
                    {{ col.header }}
                  }
                </th>
              }
              @if (actionsTpl()) {
                <th scope="col" class="px-4 py-3 text-end">
                  <span class="sr-only">{{ 'ui.table.actions' | transloco }}</span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track trackBy()(row)) {
              <tr class="border-t border-border" [class.bg-secondary-light]="isSelected(row)">
                @if (selectable()) {
                  <td class="px-2">
                    <label class="inline-flex size-11 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        class="size-5 accent-primary"
                        [checked]="isSelected(row)"
                        (change)="toggleRow(row)"
                      />
                      <span class="sr-only"
                        >{{ 'ui.table.selectRow' | transloco }} {{ rowName(row) }}</span
                      >
                    </label>
                  </td>
                }
                @for (col of columns(); track col.key) {
                  <td class="px-4 py-3" [class]="alignClass(col)">
                    <ng-container *ngTemplateOutlet="cell; context: { $implicit: row, col: col }" />
                  </td>
                }
                @if (actionsTpl(); as actions) {
                  <td class="px-4 py-2 text-end">
                    <div class="inline-flex items-center justify-end gap-2">
                      <ng-container
                        *ngTemplateOutlet="actions.template; context: { $implicit: row }"
                      />
                    </div>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- < md: cards -->
      <ul class="flex flex-col gap-3 md:hidden" [attr.aria-label]="caption()">
        @for (row of rows(); track trackBy()(row)) {
          <li
            class="card flex flex-col gap-3 p-5"
            [class.border-secondary]="isSelected(row)"
            [class.bg-secondary-light]="isSelected(row)"
          >
            <div class="flex items-start gap-2">
              @if (selectable() && selectionMode()) {
                <label
                  class="-ms-2 -mt-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center"
                >
                  <input
                    type="checkbox"
                    class="size-5 accent-primary"
                    [checked]="isSelected(row)"
                    (change)="toggleRow(row)"
                  />
                  <span class="sr-only"
                    >{{ 'ui.table.selectRow' | transloco }} {{ rowName(row) }}</span
                  >
                </label>
              }
              @if (titleColumn(); as title) {
                <p class="min-w-0 flex-1 font-semibold text-heading">
                  <ng-container *ngTemplateOutlet="cell; context: { $implicit: row, col: title }" />
                </p>
              }
            </div>
            @if (cardColumns().length) {
              <dl class="flex flex-col gap-2">
                @for (col of cardColumns(); track col.key) {
                  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <dt class="t-small text-text-muted">{{ col.header }}</dt>
                    <dd class="text-end">
                      <ng-container
                        *ngTemplateOutlet="cell; context: { $implicit: row, col: col }"
                      />
                    </dd>
                  </div>
                }
              </dl>
            }
            @if (actionsTpl(); as actions) {
              <div class="flex flex-wrap gap-2 border-t border-border pt-3">
                <ng-container *ngTemplateOutlet="actions.template; context: { $implicit: row }" />
              </div>
            }
          </li>
        }
      </ul>
    }

    <ng-template #cell let-row let-col="col">
      @if (cellTemplate(col); as tpl) {
        <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row }" />
      } @else {
        {{ plainValue(row, col) }}
      }
    </ng-template>
  `,
})
export class DataTable<T> {
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly rows = input<readonly T[]>([]);
  readonly trackBy = input.required<(row: T) => string>();
  /** Visually hidden table caption (required for a11y). */
  readonly caption = input.required<string>();
  readonly loading = input(false);
  /** `null` = no error; `''` shows the default `ui.table.error` message. */
  readonly error = input<string | null>(null);
  readonly selectable = input(false);
  readonly selection = model<readonly string[]>([]);
  readonly sort = model<DataTableSort | null>(null);

  protected readonly actionsTpl = contentChild(DataTableActions);
  protected readonly emptyTpl = contentChild(DataTableEmpty);
  protected readonly cellTpls = contentChildren(DataTableCell);

  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly selectionMode = signal(false);

  protected readonly titleColumn = computed(() => this.columns()[0] ?? null);
  protected readonly cardColumns = computed(() =>
    this.columns()
      .slice(1)
      .filter((c) => !c.hideOnMobile),
  );
  private readonly selectedSet = computed(() => new Set(this.selection()));
  protected readonly selectedCount = computed(() => this.selection().length);
  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    const set = this.selectedSet();
    return rows.length > 0 && rows.every((r) => set.has(this.trackBy()(r)));
  });
  protected readonly someSelected = computed(
    () => !this.allSelected() && this.rows().some((r) => this.selectedSet().has(this.trackBy()(r))),
  );

  protected isSelected(row: T): boolean {
    return this.selectedSet().has(this.trackBy()(row));
  }

  toggleRow(row: T): void {
    const id = this.trackBy()(row);
    this.selection.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  toggleAll(): void {
    const ids = this.rows().map((r) => this.trackBy()(r));
    if (this.allSelected()) {
      const visible = new Set(ids);
      this.selection.update((sel) => sel.filter((id) => !visible.has(id)));
    } else {
      this.selection.update((sel) => [...sel, ...ids.filter((id) => !sel.includes(id))]);
    }
  }

  protected toggleSelectionMode(): void {
    this.selectionMode.update((on) => !on);
  }

  /** asc → desc → none. */
  toggleSort(col: DataTableColumn<T>): void {
    const current = this.sort();
    if (!current || current.key !== col.key) {
      this.sort.set({ key: col.key, dir: 'asc' });
    } else if (current.dir === 'asc') {
      this.sort.set({ key: col.key, dir: 'desc' });
    } else {
      this.sort.set(null);
    }
  }

  protected ariaSort(col: DataTableColumn<T>): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    if (sort?.key !== col.key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(col: DataTableColumn<T>): IconName {
    const sort = this.sort();
    if (sort?.key !== col.key) return 'arrow-up-down';
    return sort.dir === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  protected alignClass(col: DataTableColumn<T>): string {
    return ALIGN[col.align ?? 'start'];
  }

  protected cellTemplate(col: DataTableColumn<T>): TemplateRef<DataTableCellContext<T>> | null {
    if (col.cell) return col.cell;
    const tpl = this.cellTpls().find((c) => c.key() === col.key);
    return (tpl?.template as TemplateRef<DataTableCellContext<T>> | undefined) ?? null;
  }

  protected plainValue(row: T, col: DataTableColumn<T>): string {
    const value = col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];
    return value === null || value === undefined ? '' : String(value);
  }

  protected rowName(row: T): string {
    const title = this.titleColumn();
    return (title && this.plainValue(row, title)) || this.trackBy()(row);
  }
}
