import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ContentApi, type MediaAsset } from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { DialogService } from '../../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { AltDialog } from './alt-dialog';
import { MediaStore } from './media-store';

/** The API's upload rules (media.service.ts): sniffed type, images 5 MB, PDFs 10 MB, no SVG. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function uploadProblem(
  file: Pick<File, 'type' | 'size'>,
  kind?: 'image' | 'pdf',
): string | null {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isPdf = file.type === 'application/pdf';
  if ((!isImage && !isPdf) || (kind === 'image' && !isImage) || (kind === 'pdf' && !isPdf)) {
    return kind === 'pdf'
      ? 'admin.media.errors.pdfOnly'
      : kind === 'image'
        ? 'admin.media.errors.imageOnly'
        : 'admin.media.errors.type';
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) return 'admin.media.errors.imageSize';
  if (isPdf && file.size > MAX_PDF_BYTES) return 'admin.media.errors.pdfSize';
  return null;
}

/** Upload → (image) ask for alt text → cached in MediaStore. Resolves `null` if nothing usable. */
@Injectable({ providedIn: 'root' })
export class MediaUploader {
  private readonly api = inject(ContentApi);
  private readonly store = inject(MediaStore);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);

  async upload(file: File, kind?: 'image' | 'pdf'): Promise<MediaAsset | null> {
    const problem = uploadProblem(file, kind);
    if (problem) {
      this.toasts.show({ kind: 'error', message: this.t.translate(problem) });
      return null;
    }
    let asset: MediaAsset;
    try {
      asset = await firstValueFrom(this.api.upload(file));
    } catch (error) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
      return null;
    }
    this.store.upsert(asset);
    if (asset.kind === 'image' && !asset.altAr) {
      const withAlt = await this.editAlt(asset);
      return withAlt ?? null;
    }
    return asset;
  }

  async editAlt(asset: MediaAsset): Promise<MediaAsset | undefined> {
    const ref = this.dialogs.open<MediaAsset, MediaAsset>(AltDialog, {
      data: asset,
      ariaLabelledBy: 'alt-title',
    });
    const saved = await firstValueFrom(ref.closed);
    if (saved) this.store.upsert(saved);
    return saved;
  }
}
