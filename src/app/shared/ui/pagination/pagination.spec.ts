import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Pagination, pageWindow } from './pagination';

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('windows around the current page with gaps', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10]);
    expect(pageWindow(0, 0)).toEqual([]);
  });
});

@Component({
  selector: 'app-test-pagination',
  imports: [Pagination],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-pagination [page]="page()" [total]="total()" [pageSize]="10" />`,
})
class Host {
  readonly page = signal(1);
  readonly total = signal(100);
}

describe('Pagination', () => {
  async function setup(page: number, total = 100) {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: {}, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'en' },
        }),
      ],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    await TestBed.inject(Router).navigateByUrl('/list?status=new&page=' + page);
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.page.set(page);
    fixture.componentInstance.total.set(total);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders real links that merge query params; page 1 drops the param', async () => {
    const el = await setup(5);
    const nav = el.querySelector('nav') as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('ui.pagination.label');
    const current = nav.querySelector('[aria-current="page"]') as HTMLAnchorElement;
    expect(current.tagName).toBe('A');
    // LocaleService defaults to Arabic → Arabic-Indic digits.
    expect(current.textContent?.trim()).toBe('٥');
    const first = Array.from(nav.querySelectorAll('a')).find((a) => a.textContent?.trim() === '١');
    expect(first?.getAttribute('href')).toBe('/list?status=new');
    const prev = nav.querySelector('a[rel="prev"]') as HTMLAnchorElement;
    expect(prev.getAttribute('href')).toBe('/list?status=new&page=4');
    expect(prev.getAttribute('aria-label')).toBe('ui.pagination.previous');
    expect(nav.querySelector('a[rel="next"]')?.getAttribute('href')).toBe('/list?status=new&page=6');
    expect(nav.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it('renders disabled prev on the first page and disabled next on the last', async () => {
    let el = await setup(1);
    expect(el.querySelector('a[rel="prev"]')).toBeNull();
    expect(el.querySelector('span[aria-disabled="true"]')?.textContent).toContain('ui.pagination.previous');
    TestBed.resetTestingModule();
    el = await setup(10);
    expect(el.querySelector('a[rel="next"]')).toBeNull();
    expect(el.querySelector('span[aria-disabled="true"]')?.textContent).toContain('ui.pagination.next');
  });

  it('renders nothing for a single page', async () => {
    const el = await setup(1, 5);
    expect(el.querySelector('nav')).toBeNull();
  });
});
