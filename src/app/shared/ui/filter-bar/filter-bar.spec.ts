import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FilterBar, FilterChip } from './filter-bar';

const CHIPS: FilterChip[] = [
  { value: null, label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'accepted', label: 'Accepted' },
];

@Component({
  selector: 'app-test-filter-bar',
  imports: [FilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-filter-bar
      [chips]="chips"
      [(selected)]="selected"
      [(searchValue)]="search"
      [linkMode]="linkMode()"
      queryParamName="status"
      [debounceMs]="200"
      (searchChange)="searched.push($event)"
    />
  `,
})
class Host {
  readonly chips = CHIPS;
  readonly selected = signal<string | null>(null);
  readonly search = signal('');
  readonly linkMode = signal(false);
  readonly searched: string[] = [];
}

async function setup(linkMode = false) {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { ar: {}, en: {} },
        translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
      }),
    ],
    providers: [provideRouter([{ path: '**', children: [] }])],
  });
  await TestBed.inject(Router).navigateByUrl('/news?page=3&q=x');
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.linkMode.set(linkMode);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('FilterBar', () => {
  afterEach(() => {
    TestBed.inject(Dialog).closeAll();
    vi.useRealTimers();
  });

  it('renders toggle chips with aria-pressed and updates selected', async () => {
    const { fixture, el } = await setup();
    const row = el.querySelector('[role="group"]') as HTMLElement;
    const chips = Array.from(row.querySelectorAll<HTMLButtonElement>('button.chip'));
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    chips[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('new');
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('debounces search and flushes on Enter', async () => {
    const { fixture, el } = await setup();
    vi.useFakeTimers();
    const input = el.querySelector('input[type="search"]') as HTMLInputElement;
    expect(input.classList).toContain('control');
    expect(input.id).toMatch(/^app-filter-search-/);
    expect(input.closest('label')?.querySelector('.sr-only')?.textContent).toContain('ui.filterBar.searchLabel');
    input.value = 'a';
    input.dispatchEvent(new Event('input'));
    input.value = 'ab';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.search()).toBe('ab');
    expect(fixture.componentInstance.searched).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(fixture.componentInstance.searched).toEqual(['ab']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(fixture.componentInstance.searched).toEqual(['ab', 'ab']);
  });

  it('renders crawlable links in link mode (resets page, keeps other params)', async () => {
    const { fixture, el } = await setup(true);
    fixture.componentInstance.selected.set('new');
    await fixture.whenStable();
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('[role="group"] a.chip'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/news?q=x',
      '/news?q=x&status=new',
      '/news?q=x&status=accepted',
    ]);
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links[0].getAttribute('aria-current')).toBeNull();
  });

  it('opens the chips in a bottom sheet on small screens', async () => {
    const { fixture, el } = await setup();
    const open = el.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(open.textContent).toContain('ui.filterBar.open');
    open.click();
    await fixture.whenStable();
    TestBed.tick();
    expect(document.querySelector('.cdk-overlay-pane')?.classList).toContain('app-sheet-panel');
    const sheetChips = document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-pane button.chip');
    expect(sheetChips.length).toBe(3);
    sheetChips[2].click();
    expect(fixture.componentInstance.selected()).toBe('accepted');
  });
});
