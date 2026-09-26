import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Breadcrumb, BreadcrumbItem } from './breadcrumb';
import { PageHead } from './page-head';

const transloco = TranslocoTestingModule.forRoot({
  langs: { ar: { ui: { breadcrumb: 'مسار التنقل' } }, en: {} },
  translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
});

const crumbs: BreadcrumbItem[] = [
  { label: 'الرئيسية', link: '/ar' },
  { label: 'من نحن', link: ['/ar', 'about'] },
  { label: 'مجلس الإدارة' },
];

@Component({
  imports: [PageHead],
  template: `
    <app-page-head title="مجلس الإدارة" lead="[...]" [breadcrumb]="crumbs" [headingLevel]="level">
      <a href="/x">إجراء</a>
    </app-page-head>
  `,
})
class Host {
  crumbs = crumbs;
  level: 1 | 2 = 1;
}

describe('PageHead / Breadcrumb', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [transloco], providers: [provideRouter([])] });
  });

  it('renders a band with lines, breadcrumb, h1, lead and actions', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('app-page-head') as HTMLElement;
    expect(el.classList.contains('band')).toBe(true);
    expect(el.querySelector('app-flowing-lines')).not.toBeNull();
    expect(el.querySelector('h1')!.textContent).toBe('مجلس الإدارة');
    expect(el.querySelector('.t-lead')!.textContent).toBe('[...]');
    expect(el.querySelector('a[href="/x"]')).not.toBeNull();
  });

  it('can render the title as h2', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.level = 2;
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('h2.t-h1')).not.toBeNull();
  });

  it('breadcrumb: labelled nav, links, current page, hidden separators', async () => {
    const fixture = TestBed.createComponent(Breadcrumb);
    fixture.componentRef.setInput('items', crumbs);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('nav')!.getAttribute('aria-label')).toBe('مسار التنقل');
    const items = el.querySelectorAll('li');
    expect(items.length).toBe(3);
    const links = el.querySelectorAll('a');
    expect(links.length).toBe(2);
    expect(links[1].getAttribute('href')).toBe('/ar/about');
    const current = items[2].querySelector('[aria-current="page"]')!;
    expect(current.textContent).toBe('مجلس الإدارة');
    expect(items[2].querySelector('a')).toBeNull();
    const seps = el.querySelectorAll('[aria-hidden="true"]');
    expect(seps.length).toBe(2);
    expect(seps[0].textContent).toBe('·');
  });
});
