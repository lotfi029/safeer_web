import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { Button } from '../../../shared/ui/button/button';
import {
  DataTable,
  DataTableActions,
  DataTableCell,
  DataTableColumn,
  DataTableSort,
} from '../../../shared/ui/data-table/data-table';
import { DialogFrame, DialogService } from '../../../shared/ui/dialog/dialog';
import { DrawerFrame, DrawerService } from '../../../shared/ui/drawer/drawer';
import { FilterBar, FilterChip } from '../../../shared/ui/filter-bar/filter-bar';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import { Tab, TabContent, Tabs } from '../../../shared/ui/tabs/tabs';
import { ToastOutlet, ToastService } from '../../../shared/ui/toast/toast';

const STATUSES = [
  'draft',
  'new',
  'under_review',
  'docs_missing',
  'interview',
  'accepted',
  'rejected',
] as const;
type Status = (typeof STATUSES)[number];

interface DemoRow {
  ref: string;
  status: Status;
  name: string;
  date: string;
}

const DEMO_ROWS: DemoRow[] = STATUSES.map((status, i) => ({
  ref: `SA-2026-${String(i + 1).padStart(5, '0')}`,
  status,
  name: '[...]',
  date: '[...]',
}));

@Component({
  selector: 'app-kit-demo-dialog',
  imports: [DialogFrame, Button, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame heading="[...]" headingId="kit-demo-dialog-title">
      <p class="t-muted">[...]</p>
      <button
        dialogActions
        appButton
        variant="ghost"
        size="sm"
        type="button"
        (click)="ref.close(false)"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button dialogActions appButton size="sm" type="button" (click)="ref.close(true)">
        {{ 'common.confirm' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class KitDemoDialog {
  protected readonly ref = inject(DialogRef);
}

@Component({
  selector: 'app-kit-demo-drawer',
  imports: [DrawerFrame, Button, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-frame heading="[...]" headingId="kit-demo-drawer-title">
      <ul class="flex flex-col gap-1">
        @for (item of items; track $index) {
          <li>
            <a
              class="flex min-h-11 items-center rounded-[var(--radius-btn)] px-3 hover:bg-raise"
              href="#kit-drawer"
              >[...]</a
            >
          </li>
        }
      </ul>
      <button
        drawerActions
        appButton
        variant="line"
        size="sm"
        [block]="true"
        type="button"
        (click)="ref.close()"
      >
        {{ 'common.close' | transloco }}
      </button>
    </app-drawer-frame>
  `,
})
export class KitDemoDrawer {
  protected readonly ref = inject(DialogRef);
  protected readonly items = [0, 1, 2, 3, 4, 5];
}

/** Kit demo for dialog, drawer, toast, tabs, pagination, filter bar and data table (all states). */
@Component({
  selector: 'app-kit-overlays-section',
  imports: [
    TranslocoPipe,
    Button,
    Tabs,
    Tab,
    TabContent,
    Pagination,
    FilterBar,
    DataTable,
    DataTableActions,
    DataTableCell,
    ToastOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-12' },
  template: `
    <!-- Dialog -->
    <section class="flex flex-col gap-4" aria-labelledby="kit-dialog">
      <h2 class="t-h4" id="kit-dialog">Dialog</h2>
      <div class="flex flex-wrap items-center gap-3">
        <button appButton size="sm" type="button" (click)="openDialog()">Dialog</button>
        @if (dialogResult() !== null) {
          <span class="pill pill-plain">{{ dialogResult() }}</span>
        }
      </div>
    </section>

    <!-- Drawer -->
    <section class="flex flex-col gap-4" aria-labelledby="kit-drawer">
      <h2 class="t-h4" id="kit-drawer">Drawer / bottom sheet</h2>
      <div class="flex flex-wrap gap-3">
        <button
          appButton
          variant="line"
          size="sm"
          type="button"
          aria-haspopup="dialog"
          (click)="openDrawer('end')"
        >
          side: end
        </button>
        <button
          appButton
          variant="line"
          size="sm"
          type="button"
          aria-haspopup="dialog"
          (click)="openDrawer('bottom')"
        >
          side: bottom
        </button>
      </div>
    </section>

    <!-- Toast -->
    <section class="flex flex-col gap-4" aria-labelledby="kit-toast">
      <h2 class="t-h4" id="kit-toast">Toast</h2>
      <div class="flex flex-wrap gap-3">
        <button appButton variant="soft" size="sm" type="button" (click)="toast('info')">
          info
        </button>
        <button appButton variant="soft" size="sm" type="button" (click)="toast('success')">
          success
        </button>
        <button appButton variant="danger" size="sm" type="button" (click)="toast('error')">
          error
        </button>
      </div>
      <!-- The shells will host the app-wide outlet; this one makes the demo self-contained. -->
      <app-toast-outlet />
    </section>

    <!-- Tabs -->
    <section class="flex flex-col gap-4" aria-labelledby="kit-tabs">
      <h2 class="t-h4" id="kit-tabs">Tabs</h2>
      <app-tabs [(selectedIndex)]="tabIndex" label="Tabs">
        @for (status of tabStatuses; track status) {
          <app-tab [label]="'status.' + status | transloco">
            <div class="card">[...]</div>
          </app-tab>
        }
        <app-tab [label]="'status.rejected' | transloco" [disabled]="true"
          ><div class="card">[...]</div></app-tab
        >
        <app-tab [label]="'common.more' | transloco">
          <ng-template appTabContent><div class="card">[...] (lazy)</div></ng-template>
        </app-tab>
      </app-tabs>
    </section>

    <!-- Pagination -->
    <section class="flex flex-col gap-4" aria-labelledby="kit-pagination">
      <h2 class="t-h4" id="kit-pagination">Pagination</h2>
      <app-pagination
        [page]="pageA()"
        [total]="200"
        [pageSize]="20"
        queryParamName="pa"
        label="Pagination A"
      />
      <app-pagination
        [page]="pageB()"
        [total]="200"
        [pageSize]="20"
        queryParamName="pb"
        label="Pagination B"
      />
      <app-pagination
        [page]="pageC()"
        [total]="200"
        [pageSize]="20"
        queryParamName="pc"
        label="Pagination C"
      />
    </section>

    <!-- Filter bar -->
    <section class="flex flex-col gap-4" aria-labelledby="kit-filter-bar">
      <h2 class="t-h4" id="kit-filter-bar">Filter bar</h2>
      <app-filter-bar
        [chips]="chips()"
        [(selected)]="filter"
        [(searchValue)]="search"
        (searchChange)="lastSearch.set($event)"
      />
      <p class="t-small t-muted">
        selected: <bdi>{{ filter() ?? '—' }}</bdi> · search: <bdi>{{ lastSearch() || '—' }}</bdi>
      </p>
      <app-filter-bar
        [chips]="chips()"
        [selected]="linkFilter()"
        [linkMode]="true"
        [showSearch]="false"
        queryParamName="status"
      />
    </section>

    <!-- Data table -->
    <section class="flex flex-col gap-4" aria-labelledby="kit-data-table">
      <h2 class="t-h4" id="kit-data-table">Data table</h2>
      <app-data-table
        caption="Data table"
        [columns]="columns()"
        [rows]="sortedRows()"
        [trackBy]="trackByRef"
        [selectable]="true"
        [(selection)]="selection"
        [(sort)]="sort"
      >
        <ng-template appDataTableCell="ref" let-row
          ><bdi class="ltr">{{ row.ref }}</bdi></ng-template
        >
        <ng-template appDataTableCell="status" let-row>
          <span
            class="pill"
            [class.pill-ok]="row.status === 'accepted'"
            [class.pill-warn]="row.status === 'rejected' || row.status === 'docs_missing'"
            [class.pill-plain]="row.status === 'draft'"
            >{{ 'status.' + row.status | transloco }}</span
          >
        </ng-template>
        <ng-template appDataTableActions>
          <button appButton variant="line" size="sm" type="button">
            {{ 'common.more' | transloco }}
          </button>
        </ng-template>
      </app-data-table>

      <h3 class="t-small font-semibold">loading</h3>
      <app-data-table
        caption="Data table (loading)"
        [columns]="columns()"
        [rows]="[]"
        [trackBy]="trackByRef"
        [loading]="true"
      />

      <h3 class="t-small font-semibold">error</h3>
      <app-data-table
        caption="Data table (error)"
        [columns]="columns()"
        [rows]="[]"
        [trackBy]="trackByRef"
        error=""
      />

      <h3 class="t-small font-semibold">empty</h3>
      <app-data-table
        caption="Data table (empty)"
        [columns]="columns()"
        [rows]="[]"
        [trackBy]="trackByRef"
      />
    </section>
  `,
})
export class KitOverlaysSection {
  private readonly dialogs = inject(DialogService);
  private readonly drawers = inject(DrawerService);
  private readonly toasts = inject(ToastService);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);

  protected readonly dialogResult = signal<string | null>(null);
  protected readonly tabIndex = signal(0);
  protected readonly tabStatuses: Status[] = ['new', 'under_review', 'accepted'];

  private readonly param = (name: string, fallback: number) =>
    computed(() => Number(this.query()?.get(name) ?? fallback) || fallback);
  protected readonly pageA = this.param('pa', 1);
  protected readonly pageB = this.param('pb', 5);
  protected readonly pageC = this.param('pc', 10);

  protected readonly filter = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly lastSearch = signal('');
  protected readonly linkFilter = computed(() => this.query()?.get('status') ?? null);
  private readonly allLabel = translateSignal('common.all');
  private readonly statusLabels = translateSignal(STATUSES.map((s) => `status.${s}`));
  protected readonly chips = computed<FilterChip[]>(() => [
    { value: null, label: this.allLabel() },
    ...STATUSES.map((value, i) => ({ value, label: this.statusLabels()[i] })),
  ]);

  protected readonly selection = signal<readonly string[]>([]);
  protected readonly sort = signal<DataTableSort | null>(null);
  protected readonly trackByRef = (row: DemoRow) => row.ref;
  protected readonly columns = computed<DataTableColumn<DemoRow>[]>(() => [
    { key: 'ref', header: '[...]', sortable: true },
    { key: 'status', header: '[...]', sortable: true },
    { key: 'name', header: '[...]' },
    { key: 'date', header: '[...]', hideOnMobile: true, align: 'end' },
  ]);
  protected readonly sortedRows = computed(() => {
    const sort = this.sort();
    if (!sort) return DEMO_ROWS;
    const key = sort.key as keyof DemoRow;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...DEMO_ROWS].sort((a, b) => a[key].localeCompare(b[key]) * dir);
  });

  protected openDialog(): void {
    const ref = this.dialogs.open<boolean>(KitDemoDialog, {
      ariaLabelledBy: 'kit-demo-dialog-title',
    });
    ref.closed.subscribe((result) => this.dialogResult.set(String(result ?? 'dismissed')));
  }

  protected openDrawer(side: 'end' | 'bottom'): void {
    this.drawers.open(KitDemoDrawer, { side, ariaLabelledBy: 'kit-demo-drawer-title' });
  }

  protected toast(kind: 'info' | 'success' | 'error'): void {
    this.toasts.show({ message: `[...] (${kind})`, kind });
  }
}
