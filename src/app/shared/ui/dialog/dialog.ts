import { Directionality } from '@angular/cdk/bidi';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injectable,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconButton } from '../button/button';
import { Icon } from '../icon/icon';

export interface AppDialogConfig<D = unknown> {
  data?: D;
  /** Id of the heading inside the dialog (pass the same value to `<app-dialog-frame [headingId]>`). */
  ariaLabelledBy?: string;
  ariaLabel?: string;
  /** Block Esc/backdrop close (e.g. while a request is in flight). */
  disableClose?: boolean;
  /** CSS width of the panel; defaults to min(560px, 100vw − 32px). */
  width?: string;
  role?: 'dialog' | 'alertdialog';
}

/**
 * Modal dialog on top of the CDK Dialog: focus trap, Esc/backdrop close, focus restore, scroll block
 * and `aria-modal` come from the CDK; this adds the spec panel/scrim classes and the page direction.
 *
 *   const ref = inject(DialogService).open(ConfirmDialog, { data, ariaLabelledBy: 'confirm-title' });
 *   ref.closed.subscribe(result => …);
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);
  private readonly dir = inject(Directionality);

  open<R = unknown, D = unknown, C = unknown>(
    content: ComponentType<C> | TemplateRef<C>,
    config: AppDialogConfig<D> = {},
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(content as ComponentType<C>, {
      data: config.data,
      ariaLabelledBy: config.ariaLabelledBy ?? null,
      ariaLabel: config.ariaLabel ?? null,
      role: config.role ?? 'dialog',
      disableClose: config.disableClose ?? false,
      width: config.width ?? 'min(560px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'app-dialog-panel',
      backdropClass: 'app-scrim',
      direction: this.dir.value,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  closeAll(): void {
    this.dialog.closeAll();
  }
}

let nextId = 0;

/**
 * Card surface for a dialog: heading (its id is the dialog's `aria-labelledby`), close button,
 * scrollable body and an actions row.
 *
 *   <app-dialog-frame [heading]="'…' | transloco" headingId="confirm-title">
 *     <p>…</p>
 *     <button dialogActions appButton variant="ghost" type="button">…</button>
 *     <button dialogActions appButton type="button">…</button>
 *   </app-dialog-frame>
 */
@Component({
  selector: 'app-dialog-frame',
  imports: [TranslocoPipe, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="card flex max-h-[calc(100dvh-32px)] flex-col gap-5 overflow-hidden shadow-[var(--shadow-md)]"
    >
      <div class="flex items-start justify-between gap-4">
        <h2 class="t-h3 min-w-0 flex-1" [id]="headingId()">
          {{ heading() }}<ng-content select="[dialogHeading]" />
        </h2>
        @if (closable()) {
          <button type="button" [appIconButton]="'common.close' | transloco" (click)="close()">
            <app-icon name="x" />
          </button>
        }
      </div>
      <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <ng-content />
      </div>
      <div class="flex flex-wrap items-center justify-end gap-3 empty:hidden">
        <ng-content select="[dialogActions]" />
      </div>
    </div>
  `,
})
export class DialogFrame {
  private readonly dialogRef = inject(DialogRef, { optional: true });

  readonly heading = input<string>('');
  readonly headingId = input(`app-dialog-heading-${++nextId}`);
  readonly closable = input(true);
  /** Emits when the close button is pressed (the frame also closes its CDK dialog, if any). */
  readonly dismissed = output<void>();

  close(): void {
    this.dismissed.emit();
    this.dialogRef?.close();
  }
}
