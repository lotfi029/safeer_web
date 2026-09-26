import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChoiceGroup } from './choice';

@Component({
  imports: [ChoiceGroup],
  template: `
    <app-choice-group legend="Pick" hint="Hint" error="Err" required [columns]="2">
      <label class="choice"><input type="radio" name="x" value="a" /> A</label>
      <label class="choice"><input type="radio" name="x" value="b" /> B</label>
    </app-choice-group>
  `,
})
class Host {}

describe('ChoiceGroup', () => {
  it('renders a fieldset with a legend, projected options and linked hint/error', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const fieldset = el.querySelector('fieldset') as HTMLFieldSetElement;
    expect(el.querySelector('legend')?.textContent).toContain('Pick');
    expect(el.querySelectorAll('input[type=radio]').length).toBe(2);
    const ids = fieldset.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(ids.length).toBe(2);
    expect(el.querySelector(`#${ids[0]}`)?.textContent).toContain('Hint');
    const error = el.querySelector(`#${ids[1]}`) as HTMLElement;
    expect(error.textContent).toContain('Err');
    expect(error.getAttribute('role')).toBe('alert');
    expect(el.querySelector('.grid')?.classList).toContain('sm:grid-cols-2');
  });
});
