import type { DialogRef } from '@angular/cdk/dialog';
import { HttpEventType } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, Subscription } from 'rxjs';
import type { ApplicantDocument, DocType, PortalDocumentsResponse } from '../../core/api/models';
import { PortalApi } from '../../core/api/portal-api';
import { problemMessageKey, toApiProblem } from '../../core/api/problem';
import { ApplicantSessionStore } from '../../core/auth/applicant-session.store';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { FileSizePipe, LocalDatePipe, toArabicDigits } from '../../shared/pipes/format';
import { Button } from '../../shared/ui/button/button';
import {
  DataTable,
  DataTableActions,
  DataTableCell,
  type DataTableColumn,
} from '../../shared/ui/data-table/data-table';
import { DialogFrame, DialogService } from '../../shared/ui/dialog/dialog';
import { FileDrop, type FileDropStatus } from '../../shared/ui/file-drop/file-drop';
import { Icon } from '../../shared/ui/icon/icon';
import { Progress } from '../../shared/ui/progress/progress';
import { DocStatusPill } from '../../shared/ui/status-pill/status-pill';
import { ToastService } from '../../shared/ui/toast/toast';

export interface PortalDocRow {
  key: string;
  docType: DocType;
  doc: ApplicantDocument | null;
}

/**
 * Upload rule (B3): while the application is a draft anything but an accepted document may be
 * (re)uploaded; in `docs_missing` only rejected documents and the requested types; never otherwise.
 */
export function canUpload(
  status: string | undefined,
  row: PortalDocRow,
  requested: readonly DocType[],
): boolean {
  if (row.doc?.status === 'accepted') {
    return false;
  }
  if (status === 'draft') {
    return true;
  }
  if (status === 'docs_missing') {
    return row.doc?.status === 'rejected' || requested.includes(row.docType);
  }
  return false;
}

/**
 * My documents (prototype `#/portal-docs`): completeness bar, the uploaded files as a data table
 * (cards below md) with status + rejection reason, preview via the authenticated file URL, and
 * (re)upload in a dialog only where the B3 rules allow it.
 */
@Component({
  selector: 'app-portal-documents',
  imports: [
    TranslocoPipe,
    FileSizePipe,
    LocalDatePipe,
    Button,
    DataTable,
    DataTableActions,
    DataTableCell,
    DialogFrame,
    DocStatusPill,
    FileDrop,
    Icon,
    Progress,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="wrap grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div class="flex min-w-0 flex-col gap-6">
        <div class="flex flex-col gap-2">
          <h1 class="t-h2 text-[32px]">{{ 'portal.documents.title' | transloco }}</h1>
          @if (reference(); as ref) {
            <p class="t-muted">
              {{ 'portal.documents.lead' | transloco }} <bdi dir="ltr">{{ ref }}</bdi>
            </p>
          }
        </div>
        <p class="note">{{ 'portal.documents.reuploadHint' | transloco }}</p>

        <app-data-table
          [caption]="'portal.documents.table' | transloco"
          [columns]="columns()"
          [rows]="rows()"
          [trackBy]="trackRow"
          [loading]="loading()"
          [error]="loadError()"
        >
          <ng-template appDataTableCell="document" let-row>
            <span class="flex items-center gap-3">
              <span
                class="icon-tile size-10 shrink-0"
                [class.!bg-alert-bg]="row.doc?.status === 'rejected'"
                [class.!text-alert]="row.doc?.status === 'rejected'"
              >
                <app-icon name="file" [size]="20" />
              </span>
              <span class="flex min-w-0 flex-col">
                <strong>{{ 'docType.' + row.docType | transloco }}</strong>
                @if (row.doc; as d) {
                  <span class="t-caption"
                    ><bdi>{{ d.originalName }}</bdi> · {{ d.sizeBytes | fileSize }}</span
                  >
                  @if (d.rejectionReason) {
                    <span class="t-caption !text-alert">{{
                      'portal.documents.reason' | transloco: { reason: d.rejectionReason }
                    }}</span>
                  }
                } @else {
                  <span class="t-caption">{{ 'portal.documents.notUploaded' | transloco }}</span>
                }
              </span>
            </span>
          </ng-template>
          <ng-template appDataTableCell="uploaded" let-row>
            @if (row.doc; as d) {
              <time [attr.datetime]="d.createdAt">{{ d.createdAt | localDate: 'medium' }}</time>
            } @else {
              <span aria-hidden="true">—</span>
            }
          </ng-template>
          <ng-template appDataTableCell="status" let-row>
            <app-doc-status-pill [status]="row.doc?.status ?? 'missing'" />
          </ng-template>
          <ng-template appDataTableActions let-row>
            <span class="flex flex-wrap items-center gap-2">
              @if (row.doc; as d) {
                <a
                  appButton
                  variant="link"
                  size="sm"
                  [href]="fileUrl(d.id)"
                  target="_blank"
                  rel="noopener"
                  [attr.aria-label]="
                    'portal.documents.viewLabel' | transloco: { name: d.originalName }
                  "
                  >{{ 'portal.documents.view' | transloco }}</a
                >
              }
              @if (allowed(row)) {
                <button
                  appButton
                  size="sm"
                  type="button"
                  [variant]="row.doc ? 'danger' : 'soft'"
                  (click)="openUpload(row)"
                >
                  {{
                    (row.doc ? 'portal.documents.reupload' : 'portal.documents.upload') | transloco
                  }}
                </button>
              }
            </span>
          </ng-template>
        </app-data-table>
      </div>

      <aside class="flex flex-col gap-6">
        <section class="card flex flex-col gap-4" aria-labelledby="portal-completeness">
          <h2 id="portal-completeness" class="t-h4 text-xl">
            {{ 'portal.documents.completeness' | transloco }}
          </h2>
          <app-progress [value]="percent()" [label]="completenessText()" />
          <p class="t-muted">{{ completenessText() }}</p>
        </section>
        <section class="card flex flex-col gap-3" aria-labelledby="portal-tips">
          <h2 id="portal-tips" class="t-h4 text-[19px]">
            {{ 'portal.documents.tips' | transloco }}
          </h2>
          <p class="t-muted">{{ 'portal.documents.tipsBody' | transloco }}</p>
        </section>
        <p class="note">
          <app-icon name="lock" class="shrink-0" /> {{ 'portal.documents.secure' | transloco }}
        </p>
      </aside>
    </div>

    <ng-template #uploadTpl>
      <app-dialog-frame [heading]="uploadHeading()" headingId="portal-upload-title">
        <app-file-drop
          [label]="uploadHeading()"
          [status]="uploadStatus()"
          [progress]="uploadProgress()"
          [error]="uploadError()"
          (filesSelected)="upload($event)"
        />
      </app-dialog-frame>
    </ng-template>
  `,
})
export class PortalDocuments {
  private readonly api = inject(PortalApi);
  private readonly store = inject(ApplicantSessionStore);
  private readonly t = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly data = signal<PortalDocumentsResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly reference = computed(() => this.store.me()?.reference ?? null);

  protected readonly uploading = signal<PortalDocRow | null>(null);
  protected readonly uploadStatus = signal<FileDropStatus>('idle');
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly uploadHeading = computed(() => {
    const row = this.uploading();
    return row
      ? this.t.translate('portal.documents.uploadTitle', {
          type: this.t.translate(`docType.${row.docType}`),
        })
      : '';
  });

  private readonly uploadTpl = viewChild.required<TemplateRef<unknown>>('uploadTpl');
  private dialogRef: DialogRef<unknown, unknown> | null = null;
  private sub: Subscription | null = null;

  protected readonly trackRow = (row: PortalDocRow) => row.key;

  protected readonly columns = computed<DataTableColumn<PortalDocRow>[]>(() => {
    this.locale.lang();
    return [
      {
        key: 'document',
        header: this.t.translate('portal.documents.document'),
        value: (r) => this.t.translate(`docType.${r.docType}`),
      },
      { key: 'uploaded', header: this.t.translate('portal.documents.uploaded') },
      { key: 'status', header: this.t.translate('portal.documents.status') },
    ];
  });

  private readonly requested = computed<DocType[]>(() => {
    const action = this.store.me()?.actionNeeded;
    if (!action) return [];
    return action.docTypes ?? (action.docType ? [action.docType] : []);
  });

  protected readonly rows = computed<PortalDocRow[]>(() => {
    const d = this.data();
    if (!d) return [];
    const rows: PortalDocRow[] = d.documents.map((doc) => ({
      key: doc.id,
      docType: doc.docType,
      doc,
    }));
    const missing = new Set<DocType>([...d.completeness.missingTypes, ...this.requested()]);
    for (const type of missing) {
      if (!rows.some((r) => r.docType === type)) {
        rows.push({ key: `missing-${type}`, docType: type, doc: null });
      }
    }
    return rows;
  });

  protected readonly percent = computed(() => {
    const c = this.data()?.completeness;
    return c && c.required ? Math.round((c.done / c.required) * 100) : 0;
  });
  protected readonly completenessText = computed(() => {
    const c = this.data()?.completeness;
    const n = (v: number) => (this.locale.lang() === 'ar' ? toArabicDigits(String(v)) : String(v));
    return this.t.translate('portal.documents.completenessLabel', {
      done: n(c?.done ?? 0),
      required: n(c?.required ?? 3),
    });
  });

  constructor() {
    inject(SeoService).noindex(this.t.translate('portal.documents.title'), this.locale.lang());
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [docs] = await Promise.all([
        firstValueFrom(this.api.documents()),
        this.store.refresh(),
      ]);
      this.data.set(docs);
      this.loadError.set(null);
    } catch (error) {
      this.loadError.set(this.t.translate(problemMessageKey(toApiProblem(error))));
    } finally {
      this.loading.set(false);
    }
  }

  protected allowed(row: PortalDocRow): boolean {
    return canUpload(this.store.me()?.status, row, this.requested());
  }

  protected fileUrl(id: string): string {
    return this.api.documentFileUrl(id);
  }

  protected openUpload(row: PortalDocRow): void {
    this.uploading.set(row);
    this.uploadStatus.set('idle');
    this.uploadProgress.set(null);
    this.uploadError.set(null);
    this.dialogRef = this.dialog.open(this.uploadTpl(), { ariaLabelledBy: 'portal-upload-title' });
    this.dialogRef.closed.subscribe(() => this.sub?.unsubscribe());
  }

  protected upload(files: File[]): void {
    const row = this.uploading();
    const file = files[0];
    if (!row || !file) return;
    this.uploadStatus.set('uploading');
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.sub?.unsubscribe();
    this.sub = this.api.upload(row.docType, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress.set(
            event.total ? Math.round((event.loaded / event.total) * 100) : null,
          );
        } else if (event.type === HttpEventType.Response) {
          this.uploadStatus.set('done');
          this.toast.success(this.t.translate('portal.documents.uploadedToast'));
          this.dialogRef?.close();
          void this.load();
        }
      },
      error: (error: unknown) => {
        this.uploadStatus.set('error');
        this.uploadError.set(this.t.translate(problemMessageKey(toApiProblem(error))));
      },
    });
  }
}
