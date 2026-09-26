import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icon-names';

/**
 * Centered empty state: icon tile, title, optional body and a projected action.
 * `title` / `body` are already-translated strings; the default title is 'ui.empty.title'.
 *
 *   <app-empty-state icon="file-text" [title]="…" [body]="…">
 *     <a appButton routerLink="…">…</a>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-center gap-4 px-4 py-10 text-center' },
  template: `
    <span class="icon-tile"><app-icon [name]="icon()" [size]="26" /></span>
    <p class="text-lg font-bold text-heading">{{ title() ?? ('ui.empty.title' | transloco) }}</p>
    @if (body()) {
      <p class="max-w-prose text-text-muted">{{ body() }}</p>
    }
    <ng-content />
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('file-text');
  readonly title = input<string | null>(null);
  readonly body = input<string | null>(null);
}
