import { Directionality } from '@angular/cdk/bidi';
import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { DrawerFrame, DrawerService } from './drawer';

@Component({
  selector: 'app-test-drawer',
  imports: [DrawerFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-drawer-frame heading="Menu" headingId="test-drawer-title"
    ><a href="/x">Link</a></app-drawer-frame
  >`,
})
class TestDrawer {}

describe('DrawerService + DrawerFrame', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: {}, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
    });
  });

  afterEach(() => TestBed.inject(Dialog).closeAll());

  it('opens at the inline-end edge (left in RTL) as a full-height panel', () => {
    TestBed.inject(Directionality).valueSignal.set('rtl');
    const ref = TestBed.inject(DrawerService).open(TestDrawer, {
      ariaLabelledBy: 'test-drawer-title',
    });
    TestBed.tick();
    const pane = document.querySelector('.cdk-overlay-pane') as HTMLElement;
    expect(pane.classList).toContain('app-drawer-panel');
    expect(ref.config.direction).toBe('rtl');
    expect(ref.config.width).toBe('min(320px, 100vw)');
    // `end()` in an RTL overlay → flex-end of an RTL flex row = the left edge.
    const wrapper = pane.parentElement as HTMLElement;
    expect(wrapper.getAttribute('dir')).toBe('rtl');
    expect(wrapper.style.justifyContent).toBe('flex-end');
    expect(pane.style.marginLeft).toBe('0px');
    expect(document.querySelector('app-drawer-frame > div')?.className).toContain('border-s');
  });

  it('opens a bottom sheet with rounded top corners', () => {
    TestBed.inject(Directionality).valueSignal.set('ltr');
    TestBed.inject(DrawerService).open(TestDrawer, { side: 'bottom', ariaLabel: 'Filters' });
    TestBed.tick();
    const pane = document.querySelector('.cdk-overlay-pane') as HTMLElement;
    expect(pane.classList).toContain('app-sheet-panel');
    expect(document.querySelector('.cdk-dialog-container')?.getAttribute('aria-label')).toBe(
      'Filters',
    );
    expect(document.querySelector('app-drawer-frame > div')?.className).toContain('rounded-t-');
  });

  it('closes on Escape and from the close button', () => {
    const service = TestBed.inject(DrawerService);
    const first = service.open(TestDrawer);
    TestBed.tick();
    const closed = vi.fn();
    first.closed.subscribe(closed);
    document
      .querySelector('.cdk-dialog-container')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    expect(closed).toHaveBeenCalledTimes(1);

    const second = service.open(TestDrawer);
    TestBed.tick();
    const closed2 = vi.fn();
    second.closed.subscribe(closed2);
    const close = document.querySelector<HTMLButtonElement>('app-drawer-frame button');
    expect(close?.getAttribute('aria-label')).toBe('ui.drawer.close');
    close?.click();
    expect(closed2).toHaveBeenCalled();
  });
});
