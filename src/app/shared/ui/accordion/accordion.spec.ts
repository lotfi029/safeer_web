import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Accordion, AccordionItem } from './accordion';

@Component({
  imports: [Accordion, AccordionItem],
  template: `
    <app-accordion>
      <app-accordion-item heading="سؤال ١"><p>[...]</p></app-accordion-item>
      <app-accordion-item heading="سؤال ٢" [(open)]="second"><p>[...]</p></app-accordion-item>
    </app-accordion>
  `,
})
class Host {
  second = signal(true);
}

describe('Accordion', () => {
  it('renders native details/summary with the open state', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const details = (fixture.nativeElement as HTMLElement).querySelectorAll('details');
    expect(details.length).toBe(2);
    expect(details[0].hasAttribute('open')).toBe(false);
    expect(details[1].hasAttribute('open')).toBe(true);
    expect(details[0].querySelector('summary')!.textContent).toContain('سؤال ١');
    expect(details[0].querySelector('summary app-icon')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('syncs the open model from native toggles and back', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const details = (fixture.nativeElement as HTMLElement).querySelectorAll('details')[1];
    details.open = false;
    details.dispatchEvent(new Event('toggle'));
    expect(fixture.componentInstance.second()).toBe(false);
    await fixture.whenStable();
    expect(details.hasAttribute('open')).toBe(false);

    fixture.componentInstance.second.set(true);
    await fixture.whenStable();
    expect(details.hasAttribute('open')).toBe(true);
  });
});
