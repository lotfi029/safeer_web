import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RichText } from './rich-text';

@Component({ imports: [RichText], template: `<app-rich-text [html]="html" />` })
class Host {
  html =
    '<p>ok</p><script>window.x=1</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">l</a>';
}

describe('RichText', () => {
  it('strips scripts, event handlers and javascript: URLs even if the API missed them', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = (fixture.nativeElement as HTMLElement).querySelector('app-rich-text')!;
    expect(el.innerHTML).toContain('<p>ok</p>');
    expect(el.innerHTML).not.toContain('<script');
    expect(el.innerHTML).not.toContain('onerror');
    expect(el.innerHTML).not.toMatch(/href="javascript:/);
  });
});
