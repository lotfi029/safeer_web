import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { type MediaAsset, mediaUrl } from '../../../../core/api/admin/content-api';
import { FileSizePipe } from '../../../../shared/pipes/format';
import { DialogFrame } from '../../../../shared/ui/dialog/dialog';
import { Icon } from '../../../../shared/ui/icon/icon';
import { MediaStore } from './media-store';
import { MediaUploader } from './media-uploader';

/**
 * Pick an asset for a content field (images or PDFs), or upload a new one. Images without alt text
 * can't be picked until it's added (the API would refuse them: ALT_TEXT_REQUIRED).
 */
@Component({
  selector: 'app-media-picker',
  imports: [TranslocoPipe, FileSizePipe, DialogFrame, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-frame [heading]="'admin.media.pick' | transloco" headingId="picker-title">
      <div class="flex flex-col gap-4">
        <label
          class="btn btn-soft cursor-pointer self-start focus-within:outline-2 focus-within:outline-secondary"
        >
          <app-icon name="upload" [size]="18" />{{ 'admin.media.upload' | transloco }}
          <input
            type="file"
            class="sr-only"
            [accept]="
              data.kind === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/avif'
            "
            (change)="onFile($event)"
          />
        </label>
        @if (!store.loaded()) {
          <p class="t-muted m-0" role="status">{{ 'common.loading' | transloco }}</p>
        } @else if (!assets().length) {
          <p class="t-muted m-0">{{ 'admin.media.empty' | transloco }}</p>
        } @else {
          <ul
            class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3"
            data-testid="picker-grid"
          >
            @for (a of assets(); track a.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full cursor-pointer flex-col gap-2 rounded-card border border-border bg-card p-2 text-start hover:border-secondary"
                  [attr.aria-label]="
                    (a.altAr || a.originalName) +
                    (a.kind === 'image' && !a.altAr
                      ? ' — ' + ('admin.media.noAlt' | transloco)
                      : '')
                  "
                  (click)="choose(a)"
                >
                  @if (a.kind === 'image') {
                    <img
                      [src]="url(a)"
                      alt=""
                      class="aspect-video w-full rounded-btn bg-raise object-cover"
                      loading="lazy"
                    />
                  } @else {
                    <span
                      class="grid aspect-video w-full place-items-center rounded-btn bg-raise text-decor"
                    >
                      <app-icon name="file-text" [size]="32" />
                    </span>
                  }
                  <span class="t-caption truncate" dir="auto">{{ a.altAr || a.originalName }}</span>
                  <span class="t-caption text-text-muted">{{ a.sizeBytes | fileSize }}</span>
                  @if (a.kind === 'image' && !a.altAr) {
                    <span class="pill pill-warn self-start">{{
                      'admin.media.noAlt' | transloco
                    }}</span>
                  }
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </app-dialog-frame>
  `,
})
export class MediaPicker {
  protected readonly data = inject<{ kind: 'image' | 'pdf' }>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<MediaAsset>>(DialogRef);
  protected readonly store = inject(MediaStore);
  private readonly uploader = inject(MediaUploader);
  protected readonly busy = signal(false);
  protected readonly assets = computed(() =>
    this.store.assets().filter((a) => a.kind === this.data.kind),
  );

  constructor() {
    void this.store.ensure();
  }

  protected url(a: MediaAsset): string {
    return mediaUrl(a, 'thumb');
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const asset = await this.uploader.upload(file, this.data.kind);
    if (asset) this.ref.close(asset);
  }

  protected async choose(asset: MediaAsset): Promise<void> {
    if (asset.kind === 'image' && !asset.altAr) {
      const withAlt = await this.uploader.editAlt(asset);
      if (!withAlt) return;
      asset = withAlt;
    }
    this.ref.close(asset);
  }
}
