import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Note } from './note';

@Component({
  imports: [Note],
  template: `<app-note kind="warn" live>Body</app-note><app-note kind="ok" icon="info">Ok</app-note><app-note>Info</app-note>`,
})
class Host {}

describe('Note', () => {
  it('applies kind classes, roles and default icons', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [warn, ok, info] = Array.from(fixture.nativeElement.querySelectorAll('app-note')) as HTMLElement[];
    expect(warn.classList).toContain('note-warn');
    expect(warn.getAttribute('role')).toBe('alert');
    expect(warn.querySelector('use')?.getAttribute('href')).toBe('/icons.svg#triangle-alert');
    expect(warn.textContent).toContain('Body');
    expect(ok.classList).toContain('note-ok');
    expect(ok.getAttribute('role')).toBeNull();
    expect(ok.querySelector('use')?.getAttribute('href')).toBe('/icons.svg#info');
    expect(info.classList).toContain('note');
    expect(info.querySelector('use')?.getAttribute('href')).toBe('/icons.svg#info');
  });
});
