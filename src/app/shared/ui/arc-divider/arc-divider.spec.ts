import { TestBed } from '@angular/core/testing';
import { ArcDivider } from './arc-divider';

describe('ArcDivider', () => {
  it('renders a decorative stretched arch', async () => {
    const fixture = TestBed.createComponent(ArcDivider);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const svg = host.querySelector('svg')!;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(host.classList.contains('flipped')).toBe(false);
    expect(host.style.blockSize).toBe('40px');
  });

  it('flips and switches tone', async () => {
    const fixture = TestBed.createComponent(ArcDivider);
    fixture.componentRef.setInput('flip', true);
    fixture.componentRef.setInput('tone', 'band');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('flipped')).toBe(true);
    expect(host.classList.contains('band-tone')).toBe(true);
  });
});
