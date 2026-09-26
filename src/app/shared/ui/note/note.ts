import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icon-names';

export type NoteKind = 'info' | 'warn' | 'ok';

const DEFAULT_ICON: Record<NoteKind, IconName> = {
  info: 'info',
  warn: 'triangle-alert',
  ok: 'circle-check',
};

/**
 * Inline message box (spec `.note`). Content is projected. Set `live` when the note appears in
 * response to an action so screen readers announce it: `warn` → role=alert, others → role=status.
 *
 *   <app-note kind="warn" live>…</app-note>
 */
@Component({
  selector: 'app-note',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'note',
    '[class.note-warn]': 'kind() === "warn"',
    '[class.note-ok]': 'kind() === "ok"',
    '[attr.role]': 'role()',
  },
  template: `
    <app-icon class="mt-1" [name]="iconName()" [size]="22" />
    <div class="min-w-0 grow"><ng-content /></div>
  `,
})
export class Note {
  readonly kind = input<NoteKind>('info');
  readonly icon = input<IconName | null>(null);
  readonly live = input(false);

  protected readonly iconName = computed(() => this.icon() ?? DEFAULT_ICON[this.kind()]);
  protected readonly role = computed(() =>
    this.live() ? (this.kind() === 'warn' ? 'alert' : 'status') : null,
  );
}
