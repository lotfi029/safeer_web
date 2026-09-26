import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DigitsPipe, FileSizePipe } from '../../pipes/format';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { Progress } from '../progress/progress';
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES, FileRejection, validateFiles } from './validate-files';

export type FileDropStatus = 'idle' | 'uploading' | 'done' | 'error';

let nextId = 0;

/**
 * Upload zone (prototype `.drop`). The zone itself is not clickable: the keyboard/touch path is the
 * real "choose file" button, which opens a visually-hidden `<input type=file>` (labelled by the
 * visible title). Dropping files is a pointer-only shortcut for the same action.
 *
 * Validation mirrors the backend (see `validateFiles`); only valid files are emitted in
 * `filesSelected`, the rest in `rejected` and shown in a role=alert message linked to the button
 * and input via aria-describedby. Upload state (`progress`, `status`, `error`) is driven by the
 * parent.
 */
@Component({
  selector: 'app-file-drop',
  imports: [TranslocoPipe, DigitsPipe, FileSizePipe, Button, Icon, Progress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] bg-card p-6 text-center text-heading transition-colors md:p-8"
      [class.border-dashed]="!isDragging()"
      [class.border-secondary]="!hasError()"
      [class.border-alert]="hasError()"
      [class.bg-secondary-light]="isDragging()"
      [class.opacity-60]="disabled()"
      [attr.data-dragging]="isDragging() ? 'true' : null"
      (dragenter)="onDragEnter($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
    >
      <span class="icon-tile">
        <app-icon [name]="status() === 'done' ? 'file-check' : 'cloud-upload'" [size]="26" />
      </span>
      <label class="font-bold" [for]="inputId">{{ label() ?? ('ui.fileDrop.title' | transloco) }}</label>
      <p class="field-hint m-0" [id]="hintId">
        {{ hint() ?? ('ui.fileDrop.hint' | transloco: { size: (maxBytes() | fileSize) }) }}
      </p>

      <input
        #fileInput
        type="file"
        class="sr-only"
        tabindex="-1"
        [id]="inputId"
        [accept]="accept()"
        [multiple]="multiple()"
        [disabled]="disabled() || status() === 'uploading'"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="hasError() ? 'true' : null"
        (change)="onChange(fileInput)"
      />
      <button
        appButton
        variant="ghost"
        size="sm"
        type="button"
        [disabled]="disabled() || status() === 'uploading'"
        [attr.aria-describedby]="describedBy()"
        (click)="fileInput.click()"
      >
        <app-icon name="upload" [size]="18" />
        {{ 'ui.fileDrop.choose' | transloco }}
      </button>

      @if (showProgress()) {
        <div class="flex w-full max-w-sm flex-col gap-2">
          <app-progress [value]="progress()" [label]="'ui.fileDrop.uploading' | transloco: { percent: (percentText() | digits) }" />
          <p class="t-caption m-0" aria-hidden="true">{{ 'ui.fileDrop.uploading' | transloco: { percent: (percentText() | digits) } }}</p>
        </div>
      }
      <p class="m-0 flex items-center gap-2 font-semibold text-success" role="status">
        @if (status() === 'done') {
          <app-icon name="circle-check" [size]="18" />
          {{ 'ui.fileDrop.uploaded' | transloco }}
        }
      </p>
      <div class="field-error flex flex-col gap-1" role="alert" [id]="errorId">
        @if (error()) {
          <p class="m-0">{{ error() }}</p>
        }
        @for (r of rejections(); track $index) {
          <p class="m-0">
            <bdi>{{ r.file.name }}</bdi>: {{ 'ui.fileDrop.errors.' + r.reason | transloco: { size: (maxBytes() | fileSize) } }}
          </p>
        }
      </div>
    </div>
  `,
})
export class FileDrop {
  readonly accept = input(DOCUMENT_ACCEPT);
  readonly maxBytes = input(DOCUMENT_MAX_BYTES);
  readonly multiple = input(false, { transform: booleanAttribute });
  /** Visible title (translated). Defaults to 'ui.fileDrop.title'. */
  readonly label = input<string | null>(null);
  /** Hint under the title (translated). Defaults to 'ui.fileDrop.hint' with the size limit. */
  readonly hint = input<string | null>(null);
  /** 0–100 while uploading; null hides the bar. */
  readonly progress = input<number | null>(null);
  readonly status = input<FileDropStatus>('idle');
  /** External (server) error message, already translated. */
  readonly error = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Force the drag-over look (kit/docs only). */
  readonly highlight = input(false, { transform: booleanAttribute });

  readonly filesSelected = output<File[]>();
  readonly rejected = output<FileRejection[]>();

  readonly inputId = `file-drop-${++nextId}`;
  protected readonly hintId = `${this.inputId}-hint`;
  protected readonly errorId = `${this.inputId}-error`;

  protected readonly dragging = signal(false);
  protected readonly rejections = signal<FileRejection[]>([]);
  private dragDepth = 0;
  protected readonly isDragging = computed(() => this.dragging() || this.highlight());

  protected readonly hasError = computed(
    () => this.status() === 'error' || !!this.error() || this.rejections().length > 0,
  );
  protected readonly showProgress = computed(
    () => this.status() === 'uploading' || (this.progress() !== null && this.status() !== 'done'),
  );
  protected readonly percentText = computed(() => Math.round(Math.min(100, Math.max(0, this.progress() ?? 0))));
  protected readonly describedBy = computed(() =>
    [this.hintId, this.error() || this.rejections().length ? this.errorId : null].filter(Boolean).join(' '),
  );

  /** Validates and emits; also the entry point for programmatic use and tests. */
  handleFiles(files: readonly File[]): void {
    if (this.disabled() || files.length === 0) {
      return;
    }
    const { accepted, rejected } = validateFiles(files, {
      accept: this.accept(),
      maxBytes: this.maxBytes(),
      multiple: this.multiple(),
    });
    this.rejections.set(rejected);
    if (rejected.length) {
      this.rejected.emit(rejected);
    }
    if (accepted.length) {
      this.filesSelected.emit(accepted);
    }
  }

  protected onChange(el: HTMLInputElement): void {
    this.handleFiles(Array.from(el.files ?? []));
    // Allow picking the same file again after a rejection or removal.
    el.value = '';
  }

  protected onDragEnter(event: DragEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    this.dragDepth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  protected onDragLeave(): void {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.dragging.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    if (this.status() === 'uploading') {
      return;
    }
    this.handleFiles(Array.from(event.dataTransfer?.files ?? []));
  }
}
