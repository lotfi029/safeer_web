import { Directionality } from '@angular/cdk/bidi';
import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { DialogFrame, DialogService } from './dialog';

@Component({
  selector: 'app-test-dialog',
  imports: [DialogFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame heading="Title" headingId="test-dialog-title">
      <p>Body</p>
      <button dialogActions type="button" class="confirm">OK</button>
    </app-dialog-frame>
  `,
})
class TestDialog {}

const transloco = TranslocoTestingModule.forRoot({
  langs: { ar: {}, en: {} },
  translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
});

describe('DialogService + DialogFrame', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [transloco] });
  });

  afterEach(() => {
    TestBed.inject(DialogService).closeAll();
  });

  it('opens a labelled modal with the spec classes and page direction', async () => {
    TestBed.inject(Directionality).valueSignal.set('rtl');
    const ref = TestBed.inject(DialogService).open(TestDialog, {
      ariaLabelledBy: 'test-dialog-title',
      data: { id: 1 },
    });
    TestBed.tick();
    expect(ref.config.data).toEqual({ id: 1 });
    const container = document.querySelector('.cdk-dialog-container') as HTMLElement;
    expect(container.getAttribute('role')).toBe('dialog');
    expect(container.getAttribute('aria-labelledby')).toBe('test-dialog-title');
    expect(document.getElementById('test-dialog-title')?.textContent).toContain('Title');
    expect(document.querySelector('.cdk-overlay-pane')?.classList).toContain('app-dialog-panel');
    expect(document.querySelector('.cdk-overlay-backdrop')?.classList).toContain('app-scrim');
    expect(ref.config.direction).toBe('rtl');
    expect(ref.config.autoFocus).toBe('first-tabbable');
  });

  it('closes from the frame close button', () => {
    const ref = TestBed.inject(DialogService).open(TestDialog, {
      ariaLabelledBy: 'test-dialog-title',
    });
    let closed = false;
    ref.closed.subscribe(() => (closed = true));
    TestBed.tick();
    const close = document.querySelector<HTMLButtonElement>('app-dialog-frame button[aria-label]');
    expect(close?.getAttribute('aria-label')).toBe('common.close');
    close?.click();
    expect(closed).toBe(true);
  });

  it('renders standalone and emits dismissed', () => {
    const fixture = TestBed.createComponent(DialogFrame);
    fixture.componentRef.setInput('heading', 'Hello');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.dismissed.subscribe(spy);
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    expect(spy).toHaveBeenCalled();
    expect(TestBed.inject(DialogRef, null)).toBeNull();
    // No projected actions → the actions row is :empty (hidden).
    const actions = (fixture.nativeElement as HTMLElement).querySelector('.justify-end');
    expect(actions?.childNodes.length).toBe(0);
  });
});
