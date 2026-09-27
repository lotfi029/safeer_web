import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  type AssetUsage,
  ContentApi,
  type MediaAsset,
  mediaUrl,
} from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { LocaleService } from '../../../../core/i18n/locale.service';
import { SeoService } from '../../../../core/seo/seo.service';
import { DigitsPipe, FileSizePipe } from '../../../../shared/pipes/format';
import { Button } from '../../../../shared/ui/button/button';
import { DialogService } from '../../../../shared/ui/dialog/dialog';
import { Icon } from '../../../../shared/ui/icon/icon';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { AdminPageHead } from '../../layout/admin-page-head';
import { confirmAction } from '../../shared/confirm-dialog';
import { MediaStore } from './media-store';
import { MediaUploader } from './media-uploader';

type KindFilter = 'image' | 'pdf';

/**
 * Media library: every uploaded image and PDF, upload (type/size checked like the API), alt text
 * (required before an image can be used), and delete (refused while in use: ASSET_IN_USE lists where).
 */
@Component({
  selector: 'app-media-library',
  imports: [RouterLink, TranslocoPipe, DigitsPipe, FileSizePipe, Button, Icon, AdminPageHead],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head
      [heading]="'admin.media.title' | transloco"
      [sub]="
        store.loaded()
          ? ('admin.media.total' | transloco: { count: (store.assets().length | digits) })
          : null
      "
    >
      <label
        pageActions
        class="btn btn-sm cursor-pointer focus-within:outline-2 focus-within:outline-secondary"
      >
        <app-icon name="upload" [size]="18" />{{ 'admin.media.upload' | transloco }}
        <input
          type="file"
          class="sr-only"
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
          multiple
          (change)="onFiles($event)"
          data-testid="media-upload"
        />
      </label>
    </app-admin-page-head>

    <nav class="mb-5 flex flex-wrap gap-2" [attr.aria-label]="'admin.media.filters' | transloco">
      <a
        class="chip"
        [routerLink]="[]"
        [queryParams]="{ kind: null }"
        [attr.aria-current]="!filter() ? 'page' : null"
        >{{ 'admin.content.all' | transloco }}</a
      >
      @for (k of kinds; track k) {
        <a
          class="chip"
          [routerLink]="[]"
          [queryParams]="{ kind: k }"
          [attr.aria-current]="filter() === k ? 'page' : null"
          >{{ 'admin.media.kinds.' + k | transloco }}</a
        >
      }
    </nav>

    @if (usages(); as u) {
      <div class="note note-warn mb-5" role="alert" data-testid="media-in-use">
        <app-icon name="circle-alert" />
        <div class="flex flex-col gap-1">
          <p class="m-0 font-semibold">{{ 'errors.codes.ASSET_IN_USE' | transloco }}</p>
          <ul class="m-0 ps-5">
            @for (x of u; track x.entity + x.id) {
              <li>{{ 'admin.media.usage.' + x.entity | transloco }}: {{ x.label }}</li>
            }
          </ul>
        </div>
      </div>
    }

    @if (error()) {
      <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
    } @else if (!store.loaded()) {
      <span class="skeleton block h-60" aria-hidden="true"></span>
    } @else if (!shown().length) {
      <p class="card t-muted m-0">{{ 'admin.media.empty' | transloco }}</p>
    } @else {
      <ul
        class="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        data-testid="media-grid"
      >
        @for (a of shown(); track a.id) {
          <li class="card flex flex-col gap-2 p-3" [attr.data-asset]="a.id">
            @if (a.kind === 'image') {
              <img
                [src]="url(a)"
                [alt]="a.altAr ?? ''"
                class="aspect-video w-full rounded-btn bg-raise object-cover"
                loading="lazy"
              />
            } @else {
              <a
                class="grid aspect-video w-full place-items-center rounded-btn bg-raise text-decor"
                [href]="fileUrl(a)"
                target="_blank"
                rel="noopener"
              >
                <app-icon name="file-text" [size]="32" />
                <span class="sr-only">{{ a.originalName }}</span>
              </a>
            }
            <span class="t-small truncate font-semibold" dir="auto" [attr.title]="a.originalName">{{
              a.altAr || a.originalName
            }}</span>
            <span class="t-caption text-text-muted"
              >{{ a.sizeBytes | fileSize
              }}{{ a.widthPx ? ' · ' + a.widthPx + '×' + a.heightPx : '' }}</span
            >
            @if (a.kind === 'image' && !a.altAr) {
              <span class="pill pill-warn self-start">{{ 'admin.media.noAlt' | transloco }}</span>
            }
            <div class="mt-auto flex flex-wrap items-center gap-1">
              @if (a.kind === 'image') {
                <button appButton variant="link" size="sm" type="button" (click)="editAlt(a)">
                  {{ 'admin.media.editAlt' | transloco
                  }}<span class="sr-only">: {{ a.originalName }}</span>
                </button>
              }
              <span class="grow"></span>
              <button
                type="button"
                class="icon-btn size-11 text-alert"
                [attr.aria-label]="('admin.common.delete' | transloco) + ': ' + a.originalName"
                [disabled]="busy()"
                (click)="remove(a)"
              >
                <app-icon name="trash-2" [size]="18" />
              </button>
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class MediaLibrary {
  /** Query param `?kind=`. */
  readonly kind = input<string | null>(null);

  protected readonly store = inject(MediaStore);
  private readonly api = inject(ContentApi);
  private readonly uploader = inject(MediaUploader);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly locale = inject(LocaleService);
  protected readonly kinds: readonly KindFilter[] = ['image', 'pdf'];
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  protected readonly usages = signal<AssetUsage[] | null>(null);

  protected readonly filter = computed(() =>
    this.kinds.includes(this.kind() as KindFilter) ? (this.kind() as KindFilter) : null,
  );
  protected readonly shown = computed(() => {
    const f = this.filter();
    return this.store.assets().filter((a) => !f || a.kind === f);
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    // Always refresh on open: other staff may have uploaded since.
    this.store.load().catch(() => this.error.set(true));
  }

  protected url(a: MediaAsset): string {
    return mediaUrl(a, 'card');
  }

  protected fileUrl(a: MediaAsset): string {
    return mediaUrl(a, null);
  }

  protected async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    for (const file of files) {
      const asset = await this.uploader.upload(file);
      if (asset)
        this.toasts.show({ kind: 'success', message: this.t.translate('admin.media.uploaded') });
    }
  }

  protected async editAlt(a: MediaAsset): Promise<void> {
    await this.uploader.editAlt(a);
  }

  protected async remove(a: MediaAsset): Promise<void> {
    this.usages.set(null);
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.common.confirmDelete'),
      body: this.t.translate('admin.content.deleteConfirm', { title: a.originalName }),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteMedia(a.id));
      this.store.drop(a.id);
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.deleted') });
    } catch (error) {
      const problem = toApiProblem(error);
      if (problem.code === 'ASSET_IN_USE') {
        this.usages.set((problem.extra['usages'] as AssetUsage[] | undefined) ?? []);
      } else {
        this.toasts.show({ kind: 'error', message: this.t.translate(problemMessageKey(problem)) });
      }
    } finally {
      this.busy.set(false);
    }
  }
}
