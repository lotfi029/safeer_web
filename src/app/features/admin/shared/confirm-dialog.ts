import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '../../../shared/ui/button/button';
import { DialogFrame, DialogService } from '../../../shared/ui/dialog/dialog';

export interface ConfirmData {
  heading: string;
  body: string;
  confirm: string;
  danger?: boolean;
}

/** Yes/no confirmation; closes with `true` on confirm. */
@Component({
  selector: 'app-admin-confirm',
  imports: [TranslocoPipe, Button, DialogFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame [heading]="data.heading" headingId="admin-confirm-title">
      <p class="m-0">{{ data.body }}</p>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close(false)">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        dialogActions
        appButton
        [variant]="data.danger ? 'danger' : 'primary'"
        type="button"
        (click)="ref.close(true)"
      >
        {{ data.confirm }}
      </button>
    </app-dialog-frame>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}

/** Opens ConfirmDialog and resolves `true` only when confirmed. */
export function confirmAction(dialogs: DialogService, data: ConfirmData): Promise<boolean> {
  const ref = dialogs.open<boolean, ConfirmData>(ConfirmDialog, {
    data,
    ariaLabelledBy: 'admin-confirm-title',
    role: 'alertdialog',
  });
  return new Promise((resolve) => ref.closed.subscribe((v) => resolve(v === true)));
}
