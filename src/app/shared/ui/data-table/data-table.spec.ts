import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import {
  DataTable,
  DataTableActions,
  DataTableCell,
  DataTableColumn,
  DataTableEmpty,
  DataTableSort,
} from './data-table';

interface Row {
  ref: string;
  status: string;
  note: string;
}

const ROWS: Row[] = [
  { ref: 'SA-2026-00001', status: 'new', note: '[...]' },
  { ref: 'SA-2026-00002', status: 'accepted', note: '[...]' },
];

@Component({
  selector: 'app-test-table',
  imports: [DataTable, DataTableActions, DataTableCell, DataTableEmpty],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-table
      caption="Applications"
      [columns]="columns"
      [rows]="rows()"
      [trackBy]="trackBy"
      [loading]="loading()"
      [error]="error()"
      [selectable]="true"
      [(selection)]="selection"
      [(sort)]="sort"
    >
      <ng-template appDataTableCell="status" let-row><span class="pill">{{ row.status }}</span></ng-template>
      <ng-template appDataTableActions let-row><a class="view" href="/x">{{ row.ref }}</a></ng-template>
      <ng-template appDataTableEmpty><p class="custom-empty">Nothing</p></ng-template>
    </app-data-table>
  `,
})
class Host {
  readonly columns: DataTableColumn<Row>[] = [
    { key: 'ref', header: 'Reference', sortable: true },
    { key: 'status', header: 'Status', sortable: true },
    { key: 'note', header: 'Note', hideOnMobile: true },
  ];
  readonly rows = signal<Row[]>(ROWS);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selection = signal<readonly string[]>([]);
  readonly sort = signal<DataTableSort | null>(null);
  readonly trackBy = (row: Row) => row.ref;
}

async function setup() {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { ar: {}, en: {} },
        translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('DataTable', () => {
  it('renders a semantic table and mobile cards', async () => {
    const { el } = await setup();
    const table = el.querySelector('table') as HTMLTableElement;
    expect(table.querySelector('caption')?.textContent).toContain('Applications');
    const ths = Array.from(table.querySelectorAll('thead th'));
    expect(ths.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(table.querySelectorAll('tbody tr').length).toBe(2);
    expect(table.querySelector('tbody .pill')?.textContent).toBe('new');
    expect(table.querySelector('tbody a.view')?.textContent).toBe('SA-2026-00001');

    const cards = el.querySelectorAll('ul > li');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('p')?.textContent).toContain('SA-2026-00001');
    // Title column + hideOnMobile column are not repeated in the <dl>.
    expect(Array.from(cards[0].querySelectorAll('dt')).map((d) => d.textContent)).toEqual(['Status']);
    expect(cards[0].querySelector('a.view')).not.toBeNull();
  });

  it('cycles sort asc → desc → none with aria-sort on the th', async () => {
    const { fixture, el } = await setup();
    const th = el.querySelector('thead th:nth-child(2)') as HTMLElement;
    const button = th.querySelector('button') as HTMLButtonElement;
    expect(th.getAttribute('aria-sort')).toBe('none');
    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.sort()).toEqual({ key: 'ref', dir: 'asc' });
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    button.click();
    await fixture.whenStable();
    expect(th.getAttribute('aria-sort')).toBe('descending');
    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.sort()).toBeNull();
    expect(el.querySelector('thead th:nth-child(4)')?.hasAttribute('aria-sort')).toBe(false);
  });

  it('selects rows, shows indeterminate/all states and announces the count', async () => {
    const { fixture, el } = await setup();
    const all = el.querySelector('thead input[type="checkbox"]') as HTMLInputElement;
    const rowBoxes = el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]');
    expect(rowBoxes[0].closest('label')?.textContent).toContain('ui.table.selectRow SA-2026-00001');
    rowBoxes[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selection()).toEqual(['SA-2026-00001']);
    expect(all.indeterminate).toBe(true);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('ui.table.selected');
    all.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selection()).toEqual(['SA-2026-00001', 'SA-2026-00002']);
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);
    all.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selection()).toEqual([]);
  });

  it('shows card checkboxes only in mobile selection mode', async () => {
    const { fixture, el } = await setup();
    expect(el.querySelectorAll('ul input[type="checkbox"]').length).toBe(0);
    const toggle = el.querySelector('button[aria-pressed]') as HTMLButtonElement;
    expect(toggle.textContent).toContain('ui.table.selectionMode');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toContain('ui.table.exitSelection');
    expect(el.querySelectorAll('ul input[type="checkbox"]').length).toBe(2);
  });

  it('renders loading, error and empty states', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    expect(el.querySelector('app-data-table')?.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(el.querySelector('table')).toBeNull();

    fixture.componentInstance.loading.set(false);
    fixture.componentInstance.error.set('');
    await fixture.whenStable();
    expect(el.querySelector('.note-warn[role="alert"]')?.textContent).toContain('ui.table.error');

    fixture.componentInstance.error.set(null);
    fixture.componentInstance.rows.set([]);
    await fixture.whenStable();
    expect(el.querySelector('.custom-empty')?.textContent).toBe('Nothing');
  });
});
