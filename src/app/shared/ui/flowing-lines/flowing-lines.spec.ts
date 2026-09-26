import { TestBed } from '@angular/core/testing';
import { FlowingLines } from './flowing-lines';

describe('FlowingLines', () => {
  it('renders a hidden, non-focusable decorative svg with three strokes', async () => {
    const fixture = TestBed.createComponent(FlowingLines);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const svg = host.querySelector('svg')!;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelectorAll('path').length).toBe(3);
    expect(host.classList.contains('band-tone')).toBe(false);
  });

  it('applies the band tone and custom size', async () => {
    const fixture = TestBed.createComponent(FlowingLines);
    fixture.componentRef.setInput('tone', 'band');
    fixture.componentRef.setInput('width', 420);
    fixture.componentRef.setInput('height', 300);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('band-tone')).toBe(true);
    expect(host.style.inlineSize).toBe('420px');
    expect(host.querySelector('svg')!.getAttribute('height')).toBe('300');
  });
});
