import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { EmptyState } from './empty-state';

@Component({
  imports: [EmptyState],
  template: `<app-empty-state icon="search" body="Body"><button type="button">Act</button></app-empty-state>`,
})
class Host {}

describe('EmptyState', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: { ui: { empty: { title: 'فارغ' } } }, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
    });
  });

  it('shows the default title, body and projected action', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('فارغ');
    expect(el.textContent).toContain('Body');
    expect(el.querySelector('button')?.textContent).toBe('Act');
    expect(el.querySelector('use')?.getAttribute('href')).toBe('/icons.svg#search');
  });

  it('uses a custom title', async () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'Nothing');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Nothing');
    expect(fixture.nativeElement.textContent).not.toContain('فارغ');
  });
});
