import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { type MediaAsset, mediaUrl } from '../../../../core/api/admin/content-api';
import { Button } from '../../../../shared/ui/button/button';
import { DialogService } from '../../../../shared/ui/dialog/dialog';
import { Icon } from '../../../../shared/ui/icon/icon';
import { MediaPicker } from '../media/media-picker';
import { MediaStore } from '../media/media-store';

/** An asset-id field: the current image/PDF, "choose" (library or upload) and "remove". */
@Component({
  selector: 'app-media-field',
  imports: [TranslocoPipe, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <span class="field-label">{{ label() }}</span>
    <div
      class="flex flex-wrap items-center gap-3 rounded-btn border border-dashed border-border p-3"
    >
      @if (asset(); as a) {
        @if (a.kind === 'image') {
          <img
            [src]="thumb(a)"
            [alt]="a.altAr ?? ''"
            class="h-16 w-24 rounded-btn bg-raise object-cover"
          />
        } @else {
          <app-icon name="file-text" [size]="28" class="text-decor" />
        }
        <span class="t-small min-w-0 flex-1 truncate" dir="auto" data-testid="media-field-value">{{
          a.altAr || a.originalName
        }}</span>
      } @else if (value()) {
        <span class="t-small min-w-0 flex-1 text-text-muted">#{{ value() }}</span>
      } @else {
        <span class="t-small min-w-0 flex-1 text-text-muted">{{
          'admin.media.none' | transloco
        }}</span>
      }
      <button appButton variant="line" size="sm" type="button" (click)="choose()">
        {{ 'admin.media.choose' | transloco }}<span class="sr-only"> {{ label() }}</span>
      </button>
      @if (value()) {
        <button appButton variant="ghost" size="sm" type="button" (click)="value.set('')">
          {{ 'admin.media.remove' | transloco }}<span class="sr-only"> {{ label() }}</span>
        </button>
      }
    </div>
    @if (hint()) {
      <p class="field-hint m-0">{{ hint() }}</p>
    }
  `,
})
export class MediaField {
  readonly value = model<string>('');
  readonly label = input.required<string>();
  readonly kind = input<'image' | 'pdf'>('image');
  readonly hint = input<string | null>(null);

  private readonly store = inject(MediaStore);
  private readonly dialogs = inject(DialogService);
  protected readonly asset = computed(() => this.store.get(this.value()));

  constructor() {
    void this.store.ensure();
  }

  protected thumb(a: MediaAsset): string {
    return mediaUrl(a, 'thumb');
  }

  protected async choose(): Promise<void> {
    const ref = this.dialogs.open<MediaAsset>(MediaPicker, {
      data: { kind: this.kind() },
      ariaLabelledBy: 'picker-title',
      width: 'min(760px, calc(100vw - 32px))',
    });
    const picked = await firstValueFrom(ref.closed);
    if (picked) this.value.set(picked.id);
  }
}
