import { TestBed } from '@angular/core/testing';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('is hidden from AT and renders the requested lines', async () => {
    const fixture = TestBed.createComponent(Skeleton);
    fixture.componentRef.setInput('lines', 3);
    fixture.componentRef.setInput('height', '12px');
    fixture.componentRef.setInput('width', '50%');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.style.inlineSize).toBe('50%');
    const lines = host.querySelectorAll<HTMLElement>('.skeleton');
    expect(lines.length).toBe(3);
    expect(lines[0].style.blockSize).toBe('12px');
    expect(lines[2].style.inlineSize).toBe('60%');
  });

  it('supports rounded single blocks', async () => {
    const fixture = TestBed.createComponent(Skeleton);
    fixture.componentRef.setInput('rounded', true);
    await fixture.whenStable();
    const line = fixture.nativeElement.querySelector('.skeleton') as HTMLElement;
    expect(line.classList).toContain('rounded-full');
    expect(line.style.inlineSize).toBe('100%');
  });
});
