import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AdminAssignee } from '../../../core/api/admin/admin-models';
import type { ApplicationStatus, DocType } from '../../../core/api/models';
import { Button } from '../../../shared/ui/button/button';
import { DialogFrame } from '../../../shared/ui/dialog/dialog';
import { Control, Field } from '../../../shared/ui/field/field';

const DOC_TYPES: readonly DocType[] = ['id_copy', 'certificate', 'admission_letter', 'other'];

/** Assign dialog: active admins and reviewers only (`GET /admin/applications/assignees`). */
@Component({
  selector: 'app-assign-dialog',
  imports: [TranslocoPipe, Button, DialogFrame, Field, Control],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame
      [heading]="'admin.applications.assignDialog.title' | transloco"
      headingId="assign-title"
    >
      @if (data.assignees.length) {
        <app-field [label]="'admin.applications.assignDialog.reviewer' | transloco">
          <select appControl [value]="choice()" (change)="choice.set($any($event.target).value)">
            @for (a of data.assignees; track a.id) {
              <option [value]="a.id">
                {{ a.name }} · {{ 'admin.shell.roles.' + a.role | transloco }}
              </option>
            }
          </select>
        </app-field>
      } @else {
        <p class="t-muted m-0">{{ 'admin.applications.assignDialog.noAssignees' | transloco }}</p>
      }
      @if (data.allowClear) {
        <button dialogActions appButton variant="ghost" type="button" (click)="ref.close(null)">
          {{ 'admin.applications.assignDialog.clear' | transloco }}
        </button>
      }
      <button
        dialogActions
        appButton
        type="button"
        [disabled]="!data.assignees.length"
        (click)="ref.close(choice())"
      >
        {{ 'admin.applications.assignDialog.submit' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class AssignDialog {
  protected readonly data = inject<{
    assignees: AdminAssignee[];
    current?: string | null;
    allowClear?: boolean;
  }>(DIALOG_DATA);
  /** Closes with a reviewer id, `null` to clear, or `undefined` when dismissed. */
  protected readonly ref = inject<DialogRef<string | null>>(DialogRef);
  protected readonly choice = signal(this.data.current ?? this.data.assignees[0]?.id ?? '');
}

/** Bulk status change: the targets the transition map allows from any state. */
@Component({
  selector: 'app-status-dialog',
  imports: [TranslocoPipe, Button, DialogFrame, Field, Control],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame
      [heading]="'admin.applications.statusDialog.title' | transloco"
      headingId="status-title"
    >
      <app-field
        [label]="'admin.applications.statusDialog.status' | transloco"
        [hint]="'admin.applications.statusDialog.hint' | transloco"
      >
        <select appControl [value]="choice()" (change)="choice.set($any($event.target).value)">
          @for (s of data.statuses; track s) {
            <option [value]="s">{{ 'status.' + s | transloco }}</option>
          }
        </select>
      </app-field>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button dialogActions appButton type="button" (click)="ref.close(choice())">
        {{ 'admin.applications.statusDialog.submit' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class StatusDialog {
  protected readonly data = inject<{ statuses: readonly ApplicationStatus[] }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ApplicationStatus>>(DialogRef);
  protected readonly choice = signal<ApplicationStatus>(this.data.statuses[0] ?? 'under_review');
}

export interface RequestDocsResult {
  docTypes: DocType[];
  message?: string;
}

/** Request documents: at least one type, optional message to the student (max 2000). */
@Component({
  selector: 'app-request-docs-dialog',
  imports: [TranslocoPipe, Button, DialogFrame, Field, Control],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame
      [heading]="'admin.applications.requestDialog.title' | transloco"
      headingId="request-title"
    >
      <div class="flex flex-col gap-5">
        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend class="field-label mb-2">
            {{ 'admin.applications.requestDialog.types' | transloco }}
          </legend>
          @for (t of types; track t) {
            <label class="check">
              <input type="checkbox" [checked]="picked().includes(t)" (change)="toggle(t)" />
              <span>{{ 'docType.' + t | transloco }}</span>
            </label>
          }
          @if (tried() && !picked().length) {
            <p class="field-error" role="alert">
              {{ 'admin.applications.requestDialog.pickOne' | transloco }}
            </p>
          }
        </fieldset>
        <app-field [label]="'admin.applications.requestDialog.message' | transloco">
          <textarea
            appControl
            rows="4"
            maxlength="2000"
            [value]="message()"
            (input)="message.set($any($event.target).value)"
          ></textarea>
        </app-field>
      </div>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button dialogActions appButton type="button" (click)="submit()">
        {{ 'admin.applications.requestDialog.submit' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class RequestDocsDialog {
  protected readonly ref = inject<DialogRef<RequestDocsResult>>(DialogRef);
  protected readonly types = DOC_TYPES;
  protected readonly picked = signal<DocType[]>([]);
  protected readonly message = signal('');
  protected readonly tried = signal(false);

  protected toggle(t: DocType): void {
    this.picked.update((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));
  }

  protected submit(): void {
    this.tried.set(true);
    if (!this.picked().length) return;
    const message = this.message().trim();
    this.ref.close({ docTypes: this.picked(), ...(message ? { message } : {}) });
  }
}

/** Reject a document: the reason (1–500 characters) is required and shown to the student. */
@Component({
  selector: 'app-reject-doc-dialog',
  imports: [TranslocoPipe, Button, DialogFrame, Field, Control],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame
      [heading]="'admin.review.documents.rejectDialog.title' | transloco: { type: typeLabel }"
      headingId="reject-title"
    >
      <app-field
        [label]="'admin.review.documents.rejectDialog.reason' | transloco"
        [required]="true"
        [errors]="error()"
        [forceErrors]="tried()"
      >
        <textarea
          appControl
          rows="4"
          maxlength="500"
          [value]="reason()"
          (input)="reason.set($any($event.target).value)"
        ></textarea>
      </app-field>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button dialogActions appButton variant="danger" type="button" (click)="submit()">
        {{ 'admin.review.documents.rejectDialog.submit' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class RejectDocumentDialog {
  protected readonly data = inject<{ typeLabel: string }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly typeLabel = this.data.typeLabel;
  protected readonly reason = signal('');
  protected readonly tried = signal(false);
  protected readonly error = computed(() =>
    this.reason().trim() ? [] : [{ kind: 'required' as const }],
  );

  protected submit(): void {
    this.tried.set(true);
    const reason = this.reason().trim();
    if (reason) this.ref.close(reason.slice(0, 500));
  }
}
