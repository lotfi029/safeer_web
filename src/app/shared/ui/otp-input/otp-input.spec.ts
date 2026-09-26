import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { onlyDigits, OtpInput } from './otp-input';

@Component({
  imports: [OtpInput, FormField],
  template: `<app-otp-input [formField]="f.code" />`,
})
class Host {
  readonly model = signal({ code: '' });
  readonly f = form(this.model, (p) => required(p.code));
}

function boxes(el: HTMLElement): HTMLInputElement[] {
  return Array.from(el.querySelectorAll('input'));
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('OtpInput', () => {
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

  it('normalises digits', () => {
    expect(onlyDigits('12-3 ٤٥۶')).toBe('123456');
  });

  it('renders accessible boxes in an LTR group', async () => {
    const fixture = TestBed.createComponent(OtpInput);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const group = el.querySelector('[role="group"]') as HTMLElement;
    expect(group.getAttribute('dir')).toBe('ltr');
    expect(group.getAttribute('aria-label')).toBe('ui.otp.label');
    const inputs = boxes(el);
    expect(inputs.length).toBe(6);
    expect(inputs[0].getAttribute('autocomplete')).toBe('one-time-code');
    expect(inputs[1].getAttribute('autocomplete')).toBe('off');
    expect(inputs[1].getAttribute('maxlength')).toBe('1');
    expect(inputs.every((i) => i.getAttribute('inputmode') === 'numeric' && i.getAttribute('pattern') === '[0-9]*')).toBe(true);
    expect(inputs[2].getAttribute('aria-label')).toBe('ui.otp.digit');
  });

  it('moves focus forward on typing and back on Backspace, emits completed', async () => {
    const fixture = TestBed.createComponent(OtpInput);
    fixture.componentRef.setInput('length', 3);
    await fixture.whenStable();
    const done: string[] = [];
    fixture.componentInstance.completed.subscribe((v) => done.push(v));
    const inputs = boxes(fixture.nativeElement);
    inputs[0].focus();
    type(inputs[0], '4');
    expect(document.activeElement).toBe(inputs[1]);
    type(inputs[1], 'x');
    expect(fixture.componentInstance.value()).toBe('4');
    expect(document.activeElement).toBe(inputs[1]);
    inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(document.activeElement).toBe(inputs[0]);
    expect(fixture.componentInstance.value()).toBe('');
    type(inputs[0], '1');
    type(inputs[1], '2');
    type(inputs[2], '3');
    expect(fixture.componentInstance.value()).toBe('123');
    expect(done).toEqual(['123']);
  });

  it('handles arrows in LTR order', async () => {
    const fixture = TestBed.createComponent(OtpInput);
    await fixture.whenStable();
    const inputs = boxes(fixture.nativeElement);
    inputs[2].focus();
    inputs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(inputs[3]);
    inputs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(inputs[2]);
  });

  it('fills all boxes on paste and on autofill of the first box', async () => {
    const fixture = TestBed.createComponent(OtpInput);
    await fixture.whenStable();
    const inputs = boxes(fixture.nativeElement);
    const paste = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '12 34-56' } });
    inputs[3].dispatchEvent(paste);
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('123456');
    expect(inputs.map((i) => i.value).join('')).toBe('123456');
    expect(paste.defaultPrevented).toBe(true);

    fixture.componentRef.setInput('value', '');
    await fixture.whenStable();
    type(inputs[0], '654321');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('654321');
  });

  it('reflects disabled and invalid (after touch)', async () => {
    const fixture = TestBed.createComponent(OtpInput);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('invalid', true);
    await fixture.whenStable();
    let inputs = boxes(fixture.nativeElement);
    expect(inputs.every((i) => i.disabled)).toBe(true);
    expect(inputs[0].getAttribute('aria-invalid')).toBeNull();
    fixture.componentRef.setInput('touched', true);
    await fixture.whenStable();
    inputs = boxes(fixture.nativeElement);
    expect(inputs[0].getAttribute('aria-invalid')).toBe('true');
  });

  it('works with Signal Forms [formField]', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    host.model.set({ code: '987654' });
    await fixture.whenStable();
    const inputs = boxes(fixture.nativeElement);
    expect(inputs.map((i) => i.value).join('')).toBe('987654');
    type(inputs[5], '');
    await fixture.whenStable();
    expect(host.model().code).toBe('98765');
    expect(host.f.code().invalid()).toBe(false);
    host.model.set({ code: '' });
    await fixture.whenStable();
    expect(host.f.code().invalid()).toBe(true);
  });
});
