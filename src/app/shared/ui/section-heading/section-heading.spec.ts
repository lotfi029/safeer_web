import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SectionHeading } from './section-heading';

@Component({
  imports: [SectionHeading],
  template: `
    <app-section-heading
      heading="العنوان"
      eyebrow="تمهيد"
      lead="[...]"
      [level]="level"
      [align]="align"
      headingId="sec-h"
    >
      <a headingAction href="/news">كل الأخبار</a>
    </app-section-heading>
  `,
})
class Host {
  level: 2 | 3 = 2;
  align: 'start' | 'center' = 'start';
}

async function render(level: 2 | 3 = 2, align: 'start' | 'center' = 'start') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.level = level;
  fixture.componentInstance.align = align;
  await fixture.whenStable();
  return fixture.nativeElement.querySelector('app-section-heading') as HTMLElement;
}

describe('SectionHeading', () => {
  it('renders eyebrow, h2 with id, lead and the projected action', async () => {
    const el = await render();
    const h = el.querySelector('h2')!;
    expect(h.id).toBe('sec-h');
    expect(h.textContent).toBe('العنوان');
    expect(el.querySelector('.t-eyebrow')!.textContent).toBe('تمهيد');
    expect(el.querySelector('.t-lead')!.textContent).toBe('[...]');
    expect(el.querySelector('a[headingAction]')).not.toBeNull();
    expect(el.classList.contains('md:flex-row')).toBe(true);
  });

  it('renders an h3 and centres when asked', async () => {
    const el = await render(3, 'center');
    expect(el.querySelector('h2')).toBeNull();
    expect(el.querySelector('h3')!.id).toBe('sec-h');
    expect(el.classList.contains('text-center')).toBe(true);
    expect(el.classList.contains('md:flex-row')).toBe(false);
  });

  it('omits optional parts', async () => {
    const fixture = TestBed.createComponent(SectionHeading);
    fixture.componentRef.setInput('heading', 'x');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.t-eyebrow')).toBeNull();
    expect(el.querySelector('.t-lead')).toBeNull();
    expect(el.querySelector('h2')!.hasAttribute('id')).toBe(false);
  });
});
