import { HttpEventType } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, Subscription } from 'rxjs';
import type { ApplicantDocument, DocType } from '../../core/api/models';
import { REQUIRED_DOC_TYPES } from '../../core/api/models';
import { PortalApi } from '../../core/api/portal-api';
import { problemMessageKey, toApiProblem } from '../../core/api/problem';
import { FileSizePipe } from '../../shared/pipes/format';
import { IconButton } from '../../shared/ui/button/button';
import { FileDrop, type FileDropStatus } from '../../shared/ui/file-drop/file-drop';
import { Icon } from '../../shared/ui/icon/icon';

interface Slot {
  status: FileDropStatus;
  progress: number | null;
  error: string | null;
}

export const APPLY_DOC_TYPES: readonly DocType[] = [...REQUIRED_DOC_TYPES, 'other'];

/**
 * Step 3 uploads: one file-drop per document type (`POST /portal/documents`, multipart, progress via
 * `reportProgress`). The API keeps one current document per type (W4): a new upload supersedes the
 * previous one server-side, so the list shows the latest only and the client never deletes the
 * replaced row. The remove button (`DELETE`, draft only) is for the applicant's own removal. Plus the
 * `missing` highlight after a `DOCUMENTS_INCOMPLETE` submit. Client checks (type/size) live in
 * `<app-file-drop>`; the server re-checks by magic bytes.
 */
@Component({
  selector: 'app-apply-documents',
  imports: [TranslocoPipe, FileSizePipe, IconButton, FileDrop, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid gap-5 md:grid-cols-2' },
  template: `
    @for (type of types; track type) {
      <div class="flex flex-col gap-3" [attr.data-doc-type]="type">
        <app-file-drop
          [label]="labelFor(type)"
          [status]="slot(type).status"
          [progress]="slot(type).progress"
          [error]="
            slot(type).error ?? (isMissing(type) ? ('validation.required' | transloco) : null)
          "
          [disabled]="disabled()"
          (filesSelected)="upload(type, $event)"
        />
        @if (docsOf(type).length) {
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            @for (doc of docsOf(type); track doc.id) {
              <li
                class="flex items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-2"
              >
                <app-icon name="file-check" class="shrink-0 text-success" />
                <span class="flex min-w-0 grow flex-col">
                  <bdi class="truncate font-semibold">{{ doc.originalName }}</bdi>
                  <span class="t-caption">{{ doc.sizeBytes | fileSize }}</span>
                </span>
                <button
                  type="button"
                  [appIconButton]="
                    'pages.apply.removeLabel' | transloco: { name: doc.originalName }
                  "
                  [disabled]="disabled()"
                  (click)="remove(doc)"
                >
                  <app-icon name="trash-2" />
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class ApplyDocuments {
  /** Types the last submit reported as missing (`DOCUMENTS_INCOMPLETE`). */
  readonly missing = input<readonly DocType[]>([]);
  readonly disabled = input(false);
  /** Emits the uploaded types after every change, for the aside checklist and submit guard. */
  readonly changed = output<ApplicantDocument[]>();

  private readonly api = inject(PortalApi);
  private readonly t = inject(TranslocoService);
  protected readonly types = APPLY_DOC_TYPES;
  protected readonly documents = signal<ApplicantDocument[]>([]);
  private readonly slots = signal<Partial<Record<DocType, Slot>>>({});
  private readonly uploads = new Map<DocType, Subscription>();

  readonly uploadedTypes = computed(() => new Set(this.documents().map((d) => d.docType)));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.uploads.forEach((s) => s.unsubscribe()));
    void this.reload();
  }

  protected labelFor(type: DocType): string {
    const name = this.t.translate(`docType.${type}`);
    return type === 'other' ? `${name} (${this.t.translate('pages.apply.optionalDoc')})` : name;
  }

  protected slot(type: DocType): Slot {
    return (
      this.slots()[type] ?? {
        status: this.docsOf(type).length ? 'done' : 'idle',
        progress: null,
        error: null,
      }
    );
  }

  protected docsOf(type: DocType): ApplicantDocument[] {
    return this.documents().filter((d) => d.docType === type);
  }

  protected isMissing(type: DocType): boolean {
    return this.missing().includes(type) && !this.uploadedTypes().has(type);
  }

  async reload(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.documents());
      this.setDocuments(res.documents);
    } catch {
      // Keep what we have; the submit re-checks completeness on the server.
    }
  }

  protected upload(type: DocType, files: File[]): void {
    const [first] = files;
    if (!first) {
      return;
    }
    this.setSlot(type, { status: 'uploading', progress: 0, error: null });
    this.uploads.get(type)?.unsubscribe();
    this.uploads.set(
      type,
      this.api.upload(type, first).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const pct = event.total ? Math.round((event.loaded / event.total) * 100) : null;
            this.setSlot(type, { status: 'uploading', progress: pct, error: null });
          } else if (event.type === HttpEventType.Response && event.body) {
            const doc = event.body;
            // The server superseded any earlier document of this type (W4).
            this.setDocuments([...this.documents().filter((d) => d.docType !== type), doc]);
            this.setSlot(type, null);
          }
        },
        error: (error: unknown) => {
          const problem = toApiProblem(error);
          const message = problem.fieldErrors['file']?.length
            ? this.t.translate('ui.fileDrop.errors.type')
            : this.t.translate(problemMessageKey(problem));
          this.setSlot(type, { status: 'error', progress: null, error: message });
        },
      }),
    );
  }

  protected async remove(doc: ApplicantDocument): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteDocument(doc.id));
      this.setDocuments(this.documents().filter((d) => d.id !== doc.id));
    } catch (error) {
      this.setSlot(doc.docType, {
        status: 'error',
        progress: null,
        error: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    }
  }

  private setDocuments(documents: ApplicantDocument[]): void {
    this.documents.set(documents);
    this.changed.emit(documents);
  }

  private setSlot(type: DocType, slot: Slot | null): void {
    this.slots.update((s) => {
      const next = { ...s };
      if (slot) {
        next[type] = slot;
      } else {
        delete next[type];
      }
      return next;
    });
  }
}
