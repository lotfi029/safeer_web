import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ConvertToTestimonialBody } from '../../../core/api/admin/admin-models';
import { Button } from '../../../shared/ui/button/button';
import { DialogFrame } from '../../../shared/ui/dialog/dialog';
import { Control, Field } from '../../../shared/ui/field/field';

/**
 * Convert a message to a testimonial (`POST /admin/messages/:id/convert-to-testimonial`). The quote
 * starts from the message text for the editor to trim; the result is saved as `pending`.
 */
@Component({
  selector: 'app-convert-dialog',
  imports: [TranslocoPipe, Button, DialogFrame, Field, Control],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame
      [heading]="'admin.messages.convert.title' | transloco"
      headingId="convert-title"
    >
      <div class="flex flex-col gap-5">
        <p class="t-small m-0 text-text-muted">{{ 'admin.messages.convert.lead' | transloco }}</p>
        <app-field
          [label]="'admin.messages.convert.quoteAr' | transloco"
          [required]="true"
          [errors]="quoteError()"
          [forceErrors]="tried()"
        >
          <textarea
            appControl
            rows="4"
            dir="rtl"
            [value]="quoteAr()"
            (input)="quoteAr.set($any($event.target).value)"
          ></textarea>
        </app-field>
        <app-field [label]="'admin.messages.convert.quoteEn' | transloco">
          <textarea
            appControl
            rows="3"
            dir="ltr"
            [value]="quoteEn()"
            (input)="quoteEn.set($any($event.target).value)"
          ></textarea>
        </app-field>
        <app-field [label]="'admin.messages.convert.authorName' | transloco">
          <input
            appControl
            maxlength="191"
            [value]="authorName()"
            (input)="authorName.set($any($event.target).value)"
          />
        </app-field>
        <app-field [label]="'admin.messages.convert.authorDesc' | transloco">
          <input
            appControl
            maxlength="255"
            [value]="authorDesc()"
            (input)="authorDesc.set($any($event.target).value)"
          />
        </app-field>
      </div>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button dialogActions appButton type="button" (click)="submit()">
        {{ 'admin.messages.convert.submit' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class ConvertDialog {
  private readonly data = inject<{ body: string; name: string }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ConvertToTestimonialBody>>(DialogRef);
  protected readonly quoteAr = signal(this.data.body);
  protected readonly quoteEn = signal('');
  protected readonly authorName = signal(this.data.name);
  protected readonly authorDesc = signal('');
  protected readonly tried = signal(false);
  protected readonly quoteError = computed(() =>
    this.quoteAr().trim() ? [] : [{ kind: 'required' as const }],
  );

  protected submit(): void {
    this.tried.set(true);
    const quoteAr = this.quoteAr().trim();
    if (!quoteAr) return;
    const body: ConvertToTestimonialBody = { quoteAr };
    if (this.quoteEn().trim()) body.quoteEn = this.quoteEn().trim();
    if (this.authorName().trim()) body.authorName = this.authorName().trim();
    if (this.authorDesc().trim()) body.authorDesc = this.authorDesc().trim();
    this.ref.close(body);
  }
}
