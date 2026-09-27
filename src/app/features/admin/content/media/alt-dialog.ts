import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ContentApi, type MediaAsset, mediaUrl } from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { Button } from '../../../../shared/ui/button/button';
import { DialogFrame } from '../../../../shared/ui/dialog/dialog';
import { Control, Field } from '../../../../shared/ui/field/field';

/**
 * Alt text for an image (`PATCH admin/media/:id`; `altAr` 1–255 is required). The API refuses to
 * attach an image without it (409 ALT_TEXT_REQUIRED), so uploads ask for it straight away.
 */
@Component({
  selector: 'app-alt-dialog',
  imports: [TranslocoPipe, Button, DialogFrame, Field, Control],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame [heading]="'admin.media.alt.title' | transloco" headingId="alt-title">
      <div class="flex flex-col gap-5">
        @if (asset.kind === 'image') {
          <img
            [src]="src"
            alt=""
            class="max-h-48 w-auto self-start rounded-card border border-border object-contain"
          />
        }
        <p class="t-small m-0 text-text-muted">{{ 'admin.media.alt.lead' | transloco }}</p>
        <app-field
          [label]="'admin.media.alt.ar' | transloco"
          [required]="true"
          [errors]="arError()"
          [forceErrors]="tried()"
        >
          <input
            appControl
            dir="rtl"
            maxlength="255"
            [value]="altAr()"
            (input)="altAr.set($any($event.target).value)"
          />
        </app-field>
        <app-field [label]="'admin.media.alt.en' | transloco">
          <input
            appControl
            dir="ltr"
            maxlength="255"
            [value]="altEn()"
            (input)="altEn.set($any($event.target).value)"
          />
        </app-field>
        @if (errorKey(); as key) {
          <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
        }
      </div>
      <button dialogActions appButton variant="ghost" type="button" (click)="ref.close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        dialogActions
        appButton
        type="button"
        [busy]="busy()"
        [disabled]="busy()"
        (click)="save()"
      >
        {{ 'common.save' | transloco }}
      </button>
    </app-dialog-frame>
  `,
})
export class AltDialog {
  protected readonly asset = inject<MediaAsset>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<MediaAsset>>(DialogRef);
  private readonly api = inject(ContentApi);
  protected readonly src = mediaUrl(this.asset, 'card');
  protected readonly altAr = signal(this.asset.altAr ?? '');
  protected readonly altEn = signal(this.asset.altEn ?? '');
  protected readonly tried = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly arError = computed(() =>
    this.altAr().trim() ? [] : [{ kind: 'required' as const }],
  );

  protected async save(): Promise<void> {
    this.tried.set(true);
    const altAr = this.altAr().trim();
    if (!altAr) return;
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.setAlt(this.asset.id, altAr.slice(0, 255), this.altEn().trim() || null),
      );
      this.ref.close(saved);
    } catch (error) {
      this.errorKey.set(problemMessageKey(toApiProblem(error)));
    } finally {
      this.busy.set(false);
    }
  }
}
