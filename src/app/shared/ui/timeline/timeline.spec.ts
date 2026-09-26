import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Timeline, TimelineItem } from './timeline';

const ITEMS: TimelineItem[] = [
  { key: 'received', label: 'Received', state: 'done', caption: 'Cap' },
  { key: 'review', label: 'Review', state: 'now' },
  { key: 'decision', label: 'Decision', state: 'pending' },
];

describe('Timeline', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: { ui: { timeline: { label: 'مسار', done: 'مكتملة', now: 'الآن', pending: 'لم تبدأ' } } }, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
    });
  });

  it('renders a labelled ordered list with states', async () => {
    const fixture = TestBed.createComponent(Timeline);
    fixture.componentRef.setInput('items', ITEMS);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const ol = el.querySelector('ol') as HTMLElement;
    expect(ol.getAttribute('aria-label')).toBe('مسار');
    const li = el.querySelectorAll('li');
    expect(li.length).toBe(3);
    expect(li[0].textContent).toContain('مكتملة');
    expect(li[0].textContent).toContain('Cap');
    expect(li[1].getAttribute('aria-current')).toBe('step');
    expect(li[1].textContent).toContain('الآن');
    expect(li[2].textContent).toContain('لم تبدأ');
    expect(li[2].getAttribute('aria-current')).toBeNull();
    // connecting lines between items only
    expect(el.querySelectorAll('.bg-primary.rounded-full.grow, .bg-border.rounded-full.grow').length).toBe(2);
  });

  it('switches layout classes per orientation', async () => {
    const fixture = TestBed.createComponent(Timeline);
    fixture.componentRef.setInput('items', ITEMS);
    await fixture.whenStable();
    const ol = () => fixture.nativeElement.querySelector('ol') as HTMLElement;
    expect(ol().classList).toContain('md:flex-row');
    fixture.componentRef.setInput('orientation', 'horizontal');
    await fixture.whenStable();
    expect(ol().classList).toContain('flex-row');
    expect(ol().classList).not.toContain('md:flex-row');
    fixture.componentRef.setInput('orientation', 'vertical');
    await fixture.whenStable();
    expect(ol().classList).toContain('flex-col');
    expect(ol().classList).toContain('m-0');
  });
});
