import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { FileDrop } from './file-drop';
import type { FileRejection } from './validate-files';

function file(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('FileDrop', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { ar: {}, en: {} },
          translocoConfig: { availableLangs: ['ar', 'en'], defaultLang: 'ar' },
        }),
      ],
      providers: [{ provide: LocaleService, useValue: { lang: signal('en'), intlLocale: signal('en-GB') } }],
    });
  });

  async function setup(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(FileDrop);
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    await fixture.whenStable();
    const selected: File[][] = [];
    const rejected: FileRejection[][] = [];
    fixture.componentInstance.filesSelected.subscribe((f) => selected.push(f));
    fixture.componentInstance.rejected.subscribe((r) => rejected.push(r));
    return { fixture, el: fixture.nativeElement as HTMLElement, selected, rejected };
  }

  it('uses a real button to open a labelled, hidden file input', async () => {
    const { el } = await setup();
    const input = el.querySelector('input[type=file]') as HTMLInputElement;
    const label = el.querySelector(`label[for="${input.id}"]`);
    expect(label?.textContent).toContain('ui.fileDrop.title');
    expect(input.getAttribute('accept')).toBe('application/pdf,image/jpeg,image/png');
    expect(input.tabIndex).toBe(-1);
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    button.click();
    expect(click).toHaveBeenCalled();
  });

  it('emits valid files and shows rejections in a linked alert', async () => {
    const { fixture, el, selected, rejected } = await setup();
    const good = file('a.pdf', 'application/pdf');
    const bad = file('b.gif', 'image/gif');
    fixture.componentInstance.handleFiles([good]);
    expect(selected).toEqual([[good]]);
    fixture.componentInstance.handleFiles([bad]);
    await fixture.whenStable();
    expect(rejected).toEqual([[{ file: bad, reason: 'type' }]]);
    const alert = el.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('b.gif');
    expect(alert.textContent).toContain('ui.fileDrop.errors.type');
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('accepts dropped files and toggles the drag state', async () => {
    const { fixture, el, selected } = await setup();
    const zone = el.firstElementChild as HTMLElement;
    zone.dispatchEvent(new Event('dragenter', { cancelable: true }));
    await fixture.whenStable();
    expect(zone.getAttribute('data-dragging')).toBe('true');
    const drop = new Event('drop', { cancelable: true });
    const good = file('a.png', 'image/png');
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [good] } });
    zone.dispatchEvent(drop);
    await fixture.whenStable();
    expect(zone.getAttribute('data-dragging')).toBeNull();
    expect(selected).toEqual([[good]]);
  });

  it('shows upload progress, done and external errors', async () => {
    const { fixture, el } = await setup({ status: 'uploading', progress: 40 });
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(el.querySelector('button')?.disabled).toBe(true);
    fixture.componentRef.setInput('status', 'done');
    await fixture.whenStable();
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('ui.fileDrop.uploaded');
    fixture.componentRef.setInput('error', 'Server says no');
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Server says no');
  });

  it('ignores files when disabled', async () => {
    const { fixture, selected } = await setup({ disabled: true });
    fixture.componentInstance.handleFiles([file('a.pdf', 'application/pdf')]);
    expect(selected).toEqual([]);
  });
});
