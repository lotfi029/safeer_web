import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import type { OrgNode } from '../../../core/api/models';
import { OrgChart } from './org-chart';

const forest: OrgNode[] = [
  {
    id: '1',
    name: 'الجمعية العمومية',
    tone: 'neutral',
    holders: [],
    children: [
      {
        id: '2',
        name: 'مجلس الإدارة',
        tone: 'sky',
        holders: [{ id: '10', name: 'أ. فلان' }],
        children: [],
      },
      { id: '3', name: 'المدير التنفيذي', tone: 'brand', holders: [], children: [] },
    ],
  },
];

describe('OrgChart', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            ar: { ui: { orgChart: { caption: 'الهيكل التنظيمي', under: 'تحت {{name}}' } } },
            en: {},
          },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
    });
  });

  async function render(nodes: OrgNode[]): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(OrgChart);
    fixture.componentRef.setInput('nodes', nodes);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a labelled nested list, one box per position, with tones and holders', async () => {
    const host = await render(forest);
    const root = host.querySelector('ul.forest')!;
    const caption = host.querySelector(`#${root.getAttribute('aria-labelledby')}`)!;
    expect(caption.textContent).toContain('الهيكل التنظيمي');
    expect(caption.classList.contains('sr-only')).toBe(true);

    const labels = [...host.querySelectorAll('.box-label')].map((e) => e.textContent?.trim());
    expect(labels).toEqual(['الجمعية العمومية', 'مجلس الإدارة', 'المدير التنفيذي']);
    expect(host.querySelector('.box.tone-sky .holders li')!.textContent).toContain('أ. فلان');
    expect(host.querySelector('.box.tone-brand .holders')).toBeNull();
    expect(host.querySelector('ul.tree:not(.forest)')!.getAttribute('aria-label')).toBe(
      'تحت الجمعية العمومية',
    );
  });

  it('is not a scroll region or a tab stop', async () => {
    const host = await render(forest);
    expect(host.querySelector('[tabindex]')).toBeNull();
    expect(host.querySelector('[role="region"]')).toBeNull();
  });

  it('renders nothing for an empty forest', async () => {
    const host = await render([]);
    expect(host.querySelector('ul')).toBeNull();
  });
});
