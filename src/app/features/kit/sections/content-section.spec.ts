import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { KitContentSection } from './content-section';

describe('KitContentSection', () => {
  it('renders every demo without an h1 or main', async () => {
    TestBed.configureTestingModule({
      imports: [
        KitContentSection,
        TranslocoTestingModule.forRoot({
          langs: { ar: {}, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(KitContentSection);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1, main')).toBeNull();
    expect(el.querySelectorAll('section[aria-labelledby]').length).toBe(9);
    expect(el.querySelectorAll('app-counter').length).toBe(3);
  });
});
