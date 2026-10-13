import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Pill } from './status-pill';

@Component({
  imports: [Pill],
  template: `<app-pill variant="solid">X</app-pill><app-pill>Y</app-pill>`,
})
class Host {}

describe('pill', () => {
  it('renders the variant class and the projected text', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [solid, teal] = fixture.nativeElement.querySelectorAll('app-pill') as HTMLElement[];
    expect(solid.classList).toContain('pill');
    expect(solid.classList).toContain('pill-solid');
    expect(solid.textContent).toBe('X');
    expect(teal.className).not.toMatch(/pill-/);
  });
});
