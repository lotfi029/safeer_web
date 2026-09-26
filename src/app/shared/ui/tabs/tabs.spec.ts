import { Directionality } from '@angular/cdk/bidi';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Tab, TabContent, Tabs } from './tabs';

@Component({
  selector: 'app-test-tabs',
  imports: [Tabs, Tab, TabContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-tabs [(selectedIndex)]="index" label="Sections">
      <app-tab label="One">first</app-tab>
      <app-tab label="Two" [disabled]="true">second</app-tab>
      <app-tab label="Three"><ng-template appTabContent><span class="lazy">third</span></ng-template></app-tab>
    </app-tabs>
  `,
})
class Host {
  readonly index = signal(0);
}

function setup(dir: 'ltr' | 'rtl') {
  TestBed.configureTestingModule({});
  TestBed.inject(Directionality).valueSignal.set(dir);
  const fixture = TestBed.createComponent(Host, { bindings: [] });
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const tabs = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = () => Array.from(el.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
  const key = (key: string) => {
    tabs()[fixture.componentInstance.index()].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };
  return { fixture, el, tabs, panels, key };
}

describe('Tabs', () => {
  it('wires the ARIA tabs pattern with roving tabindex and hidden panels', () => {
    const { el, tabs, panels } = setup('ltr');
    expect(el.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Sections');
    const [t1, t2] = tabs();
    const [p1, p2, p3] = panels();
    expect(t1.getAttribute('aria-selected')).toBe('true');
    expect(t1.tabIndex).toBe(0);
    expect(t2.tabIndex).toBe(-1);
    expect(t1.getAttribute('aria-controls')).toBe(p1.id);
    expect(p1.getAttribute('aria-labelledby')).toBe(t1.id);
    expect(p1.hidden).toBe(false);
    expect(p2.hidden).toBe(true);
    // Inactive panels stay in the DOM; lazy content waits for activation.
    expect(p2.textContent).toContain('second');
    expect(p3.querySelector('.lazy')).toBeNull();
  });

  it('moves with arrows in LTR, skipping disabled tabs, plus Home/End', () => {
    const { fixture, key, panels } = setup('ltr');
    key('ArrowRight');
    expect(fixture.componentInstance.index()).toBe(2);
    expect(panels()[2].querySelector('.lazy')).not.toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe('Three');
    key('ArrowRight');
    expect(fixture.componentInstance.index()).toBe(0);
    key('End');
    expect(fixture.componentInstance.index()).toBe(2);
    key('Home');
    expect(fixture.componentInstance.index()).toBe(0);
    key('ArrowLeft');
    expect(fixture.componentInstance.index()).toBe(2);
  });

  it('reverses arrows in RTL (ArrowLeft = next)', () => {
    const { fixture, key } = setup('rtl');
    key('ArrowLeft');
    expect(fixture.componentInstance.index()).toBe(2);
    key('ArrowRight');
    expect(fixture.componentInstance.index()).toBe(0);
  });

  it('selects on click and ignores disabled tabs', () => {
    const { fixture, tabs } = setup('ltr');
    tabs()[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.index()).toBe(2);
    expect(tabs()[1].disabled).toBe(true);
  });
});
