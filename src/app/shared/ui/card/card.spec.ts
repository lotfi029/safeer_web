import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Card, FeatureCard } from './card';

@Component({
  imports: [Card, FeatureCard],
  template: `
    <app-card id="c1"><p>[...]</p></app-card>
    <app-card id="c2" hover flush tone="surface">x</app-card>
    <app-card id="c3" tone="band">x</app-card>
    <app-feature-card id="f1" icon="book-open" heading="الدعم الأكاديمي" body="[...]" [level]="4">
      <a href="/x">المزيد</a>
    </app-feature-card>
  `,
})
class Host {}

describe('Card / FeatureCard', () => {
  let el: HTMLElement;
  beforeEach(async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('applies card classes per input', () => {
    const c1 = el.querySelector('#c1')!.classList;
    expect(c1.contains('card')).toBe(true);
    expect(c1.contains('card-hover')).toBe(false);
    const c2 = el.querySelector('#c2')!.classList;
    expect(c2.contains('card-hover')).toBe(true);
    expect(c2.contains('card-flush')).toBe(true);
    expect(c2.contains('bg-surface')).toBe(true);
    expect(el.querySelector('#c3')!.classList.contains('band')).toBe(true);
    expect(el.querySelector('#c1 p')!.textContent).toBe('[...]');
  });

  it('feature card renders icon tile, heading level, body and projected link', () => {
    const f = el.querySelector('#f1')!;
    expect(f.classList.contains('card-hover')).toBe(true);
    expect(f.querySelector('.icon-tile app-icon')).not.toBeNull();
    expect(f.querySelector('h4')!.textContent).toBe('الدعم الأكاديمي');
    expect(f.querySelector('p')!.textContent).toBe('[...]');
    expect(f.querySelector('a[href="/x"]')).not.toBeNull();
  });
});
