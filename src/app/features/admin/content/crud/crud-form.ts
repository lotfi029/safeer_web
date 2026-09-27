import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ContentApi, type ContentRow } from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { Button } from '../../../../shared/ui/button/button';
import { DialogFrame } from '../../../../shared/ui/dialog/dialog';
import type { FieldErrorLike } from '../../../../shared/ui/field/field';
import { type CrudConfig, emptyModel, modelFromRow, pick, toBody, validate } from './crud-config';
import { CrudFields, toFieldErrors } from './crud-fields';

export interface CrudFormData {
  config: CrudConfig;
  /** The row to edit; absent to create. */
  row?: ContentRow;
  /** Values fixed by the page (parent id, the current tab). */
  context?: Record<string, unknown>;
}

/**
 * Create/edit dialog of a CRUD collection. Client checks mirror the DTOs; the API's field issues
 * land on their fields; any other problem shows above the buttons. Closes with the saved row.
 */
@Component({
  selector: 'app-crud-form',
  imports: [TranslocoPipe, Button, DialogFrame, CrudFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame [heading]="heading" headingId="crud-form-title">
      <form class="flex flex-col gap-5" novalidate (submit)="save($event)" id="crud-form">
        <app-crud-fields
          [fields]="config.fields"
          [(model)]="model"
          [errors]="errors()"
          [editing]="mode === 'update'"
        />
        @if (errorKey(); as key) {
          <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
        }
      </form>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        dialogActions
        appButton
        type="submit"
        form="crud-form"
        [busy]="busy()"
        [disabled]="busy()"
      >
        {{ 'common.save' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class CrudForm {
  protected readonly data = inject<CrudFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ContentRow>>(DialogRef);
  private readonly api = inject(ContentApi);
  private readonly t = inject(TranslocoService);

  protected readonly config = this.data.config;
  protected readonly mode: 'create' | 'update' = this.data.row ? 'update' : 'create';
  protected readonly heading = this.t.translate(
    `admin.content.${this.mode === 'create' ? 'add' : 'edit'}`,
    {
      item: this.t.translate(`admin.content.${this.config.id}.item`),
    },
  );
  protected readonly model = signal<Record<string, unknown>>({
    ...emptyModel(this.config.fields),
    ...(this.data.row ? modelFromRow(this.config.fields, this.data.row) : {}),
    ...(this.data.context ?? {}),
  });
  protected readonly busy = signal(false);
  private readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly server = signal<{
    model: Record<string, unknown>;
    errors: Record<string, string[]>;
  }>({
    model: {},
    errors: {},
  });
  private readonly client = computed(() => validate(this.config.fields, this.model()));

  /** Client errors after a save attempt, plus the API's issues until that field changes. */
  protected readonly errors = computed<Record<string, FieldErrorLike[]>>(() => {
    const out = this.tried()
      ? toFieldErrors(this.client(), this.config.fields, (k) => this.t.translate(k))
      : {};
    const { model, errors } = this.server();
    for (const [key, messages] of Object.entries(errors)) {
      if (model[key] !== this.model()[key]) continue;
      out[key] = [...(out[key] ?? []), ...messages.map((message) => ({ kind: 'server', message }))];
    }
    return out;
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    if (Object.keys(this.client()).length) return;
    const body = toBody(this.config.fields, this.model(), this.mode);
    this.busy.set(true);
    try {
      const saved =
        this.mode === 'create'
          ? await firstValueFrom(this.api.create(this.config.endpoint, body))
          : await firstValueFrom(this.api.update(this.config.endpoint, this.data.row!.id, body));
      this.ref.close(saved);
    } catch (error) {
      const problem = toApiProblem(error);
      this.server.set({ model: this.model(), errors: problem.fieldErrors });
      this.errorKey.set(problemMessageKey(problem));
    } finally {
      this.busy.set(false);
    }
  }
}

/** The title shown for a row in lists and confirmations. */
export function rowTitle(config: CrudConfig, row: ContentRow, lang: 'ar' | 'en'): string {
  return config.primary(row, lang) || pick(row, 'title', lang) || `#${row.id}`;
}
