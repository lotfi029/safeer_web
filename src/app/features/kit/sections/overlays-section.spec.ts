import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { KitOverlaysSection } from './overlays-section';

describe('KitOverlaysSection', () => {
  it('renders every demo block with a labelled heading and no main/h1', async () => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: {}, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(KitOverlaysSection);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const sections = Array.from(el.querySelectorAll('section[aria-labelledby]'));
    expect(sections.length).toBe(7);
    for (const s of sections) {
      expect(el.querySelector(`#${s.getAttribute('aria-labelledby')}`)?.tagName).toBe('H2');
    }
    expect(el.querySelector('main, h1')).toBeNull();
    expect(el.querySelectorAll('app-data-table').length).toBe(4);
    expect(el.querySelectorAll('app-pagination nav').length).toBe(3);

    (el.querySelector('#kit-dialog + div button') as HTMLButtonElement).click();
    TestBed.tick();
    expect(document.querySelector('app-kit-demo-dialog')).not.toBeNull();
    TestBed.inject(Dialog).closeAll();
  });
});
