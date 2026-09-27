import {
  CdkDrag,
  type CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ContentApi, type ContentRow, mediaUrl } from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { StaffSessionStore } from '../../../../core/auth/staff-session.store';
import { LocaleService } from '../../../../core/i18n/locale.service';
import { DigitsPipe } from '../../../../shared/pipes/format';
import { Button } from '../../../../shared/ui/button/button';
import { DialogService } from '../../../../shared/ui/dialog/dialog';
import { Icon } from '../../../../shared/ui/icon/icon';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { confirmAction } from '../../shared/confirm-dialog';
import { MediaStore } from '../media/media-store';
import type { CrudConfig } from './crud-config';
import { CrudForm, type CrudFormData, rowTitle } from './crud-form';

const PAGE = 100;

/** New `sortOrder` values after moving `from` → `to` (the whole list is renumbered 0…n-1). */
export function reorderedIds<T extends { id: string }>(
  rows: readonly T[],
  from: number,
  to: number,
) {
  const next = [...rows];
  moveItemInArray(next, from, to);
  return { rows: next, body: next.map((r, i) => ({ id: r.id, sortOrder: i })) };
}

/** Is the row visible on the site? (`isPublished`, or `status === 'published'` for testimonials). */
export function isLive(config: CrudConfig, row: ContentRow): boolean {
  return config.publish === 'status' ? row['status'] === 'published' : row['isPublished'] !== false;
}

/**
 * One CRUD collection as an ordered list (config-driven, prototype `aWork`/`aBoard`/…): drag or
 * keyboard (move up/down) reorder on sortable collections, a publish switch, edit in a dialog,
 * delete behind a confirmation. Child collections (work-area items) nest under their row.
 */
@Component({
  selector: 'app-crud-list',
  imports: [
    RouterLink,
    TranslocoPipe,
    DigitsPipe,
    Button,
    Icon,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3', '[attr.data-collection]': 'config().id' },
  template: `
    @if (!child()) {
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="t-h4 m-0 text-heading">
          {{ 'admin.content.' + config().id + '.title' | transloco }}
          @if (total() !== null) {
            <span class="t-small font-normal text-text-muted">({{ total() | digits }})</span>
          }
        </h2>
        <button appButton size="sm" type="button" (click)="add()">
          <app-icon name="plus" [size]="18" />{{
            'admin.content.add'
              | transloco: { item: ('admin.content.' + config().id + '.item' | transloco) }
          }}
        </button>
      </div>
      @if (config().searchable) {
        <label class="relative block sm:max-w-80">
          <span class="sr-only">{{ 'admin.content.search' | transloco }}</span>
          <app-icon
            name="search"
            class="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-decor"
          />
          <input
            type="search"
            class="control ps-12"
            [placeholder]="'admin.content.search' | transloco"
            [value]="q()"
            (input)="onSearch($any($event.target).value)"
          />
        </label>
      }
    }

    @if (error()) {
      <div class="note note-warn" role="alert">
        <app-icon name="circle-alert" />
        <p class="m-0">{{ 'admin.common.loadError' | transloco }}</p>
        <button appButton variant="line" size="sm" type="button" (click)="load()">
          {{ 'common.retry' | transloco }}
        </button>
      </div>
    } @else if (loading() && !rows().length) {
      <div class="flex flex-col gap-2" aria-hidden="true">
        @for (i of [1, 2, 3]; track i) {
          <span class="skeleton h-16"></span>
        }
      </div>
    } @else if (!rows().length) {
      <p class="t-muted m-0" [class.card]="!child()">{{ 'admin.content.empty' | transloco }}</p>
    } @else {
      <ol
        class="m-0 flex list-none flex-col gap-2 p-0"
        cdkDropList
        [cdkDropListDisabled]="!canReorder()"
        (cdkDropListDropped)="drop($event)"
        [attr.aria-label]="'admin.content.' + config().id + '.title' | transloco"
        data-testid="crud-rows"
      >
        @for (row of rows(); track row.id; let i = $index; let first = $first; let last = $last) {
          <li
            cdkDrag
            [cdkDragData]="row"
            class="flex flex-col gap-3 rounded-card border border-border p-3 md:p-4"
            [class]="child() ? 'bg-raise' : 'bg-card'"
            [attr.data-row]="row.id"
          >
            <div class="flex flex-wrap items-center gap-3">
              @if (canReorder()) {
                <span
                  cdkDragHandle
                  class="hidden cursor-grab text-decor md:inline-flex"
                  aria-hidden="true"
                >
                  <app-icon name="grip-vertical" [size]="18" />
                </span>
              }
              @if (config().thumb; as thumbKey) {
                @if (thumbOf(row, thumbKey); as src) {
                  <img
                    [src]="src"
                    alt=""
                    class="size-12 shrink-0 rounded-btn bg-raise object-cover"
                    loading="lazy"
                  />
                } @else {
                  <span
                    class="grid size-12 shrink-0 place-items-center rounded-btn bg-raise text-decor"
                    aria-hidden="true"
                  >
                    <app-icon name="image" [size]="20" />
                  </span>
                }
              }
              <div class="flex min-w-0 flex-1 basis-48 flex-col">
                <span
                  class="line-clamp-2 font-semibold text-heading"
                  dir="auto"
                  data-testid="row-title"
                  >{{ title(row) }}</span
                >
                @if (subtitle(row); as sub) {
                  <span class="t-small text-text-muted" dir="auto">{{ sub }}</span>
                }
              </div>
              <div class="flex flex-wrap items-center gap-2">
                @if (config().publish === 'status') {
                  <span
                    class="pill"
                    [class.pill-ok]="row['status'] === 'published'"
                    [class.pill-warn]="row['status'] === 'pending'"
                    [class.pill-plain]="row['status'] === 'hidden'"
                  >
                    {{ 'admin.content.options.status.' + row['status'] | transloco }}
                  </span>
                  @if (row['status'] !== 'published') {
                    <button
                      appButton
                      variant="soft"
                      size="sm"
                      type="button"
                      [disabled]="busy()"
                      (click)="setStatus(row, 'published')"
                    >
                      {{ 'admin.content.testimonials.publish' | transloco }}
                    </button>
                  }
                  @if (row['status'] !== 'hidden') {
                    <button
                      appButton
                      variant="line"
                      size="sm"
                      type="button"
                      [disabled]="busy()"
                      (click)="setStatus(row, 'hidden')"
                    >
                      {{ 'admin.content.testimonials.hide' | transloco }}
                    </button>
                  }
                } @else if (config().publish) {
                  <button
                    type="button"
                    role="switch"
                    class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-1"
                    [attr.aria-checked]="isLive(row)"
                    [disabled]="busy()"
                    (click)="togglePublish(row)"
                  >
                    <span
                      class="relative inline-block h-6 w-11 rounded-full transition-colors"
                      [class]="isLive(row) ? 'bg-secondary' : 'bg-border'"
                      aria-hidden="true"
                    >
                      <span
                        class="absolute top-0.5 size-5 rounded-full bg-card shadow transition-all"
                        [class]="isLive(row) ? 'start-5.5' : 'start-0.5'"
                      ></span>
                    </span>
                    <span class="t-small">{{
                      (isLive(row) ? 'admin.content.published' : 'admin.content.hidden') | transloco
                    }}</span>
                    <span class="sr-only">: {{ title(row) }}</span>
                  </button>
                }
                @if (canReorder()) {
                  <button
                    type="button"
                    class="icon-btn size-11"
                    [disabled]="first || busy()"
                    [attr.aria-label]="('admin.content.moveUp' | transloco) + ': ' + title(row)"
                    (click)="move(i, i - 1)"
                  >
                    <app-icon name="arrow-up" [size]="18" [directional]="false" />
                  </button>
                  <button
                    type="button"
                    class="icon-btn size-11"
                    [disabled]="last || busy()"
                    [attr.aria-label]="('admin.content.moveDown' | transloco) + ': ' + title(row)"
                    (click)="move(i, i + 1)"
                  >
                    <app-icon name="arrow-down" [size]="18" [directional]="false" />
                  </button>
                }
                @if (config().link; as link) {
                  <a
                    appButton
                    variant="soft"
                    size="sm"
                    [routerLink]="locale.link('/admin/' + link.path(row))"
                  >
                    {{ link.label | transloco }}<span class="sr-only">: {{ title(row) }}</span>
                  </a>
                }
                <button appButton variant="link" size="sm" type="button" (click)="edit(row)">
                  {{ 'admin.content.editShort' | transloco
                  }}<span class="sr-only">: {{ title(row) }}</span>
                </button>
                @if (canDelete()) {
                  <button
                    type="button"
                    class="icon-btn size-11 text-alert"
                    [attr.aria-label]="('admin.common.delete' | transloco) + ': ' + title(row)"
                    [disabled]="busy()"
                    (click)="remove(row)"
                  >
                    <app-icon name="trash-2" [size]="18" />
                  </button>
                }
              </div>
            </div>
            @if (config().children; as kids) {
              <app-crud-list
                class="md:ps-8"
                [config]="kids.config"
                [context]="childContext(kids.parentKey, row.id)"
                [child]="true"
              />
            }
          </li>
        }
      </ol>
      @if (reorderNote(); as note) {
        <p class="t-small m-0 text-text-muted">{{ note | transloco }}</p>
      }
    }
    @if (child()) {
      <button appButton variant="soft" size="sm" type="button" class="self-start" (click)="add()">
        <app-icon name="plus" [size]="16" />{{
          'admin.content.add'
            | transloco: { item: ('admin.content.' + config().id + '.item' | transloco) }
        }}
      </button>
    }
    <p class="sr-only" role="status" aria-live="polite">{{ announce() }}</p>
  `,
})
export class CrudList {
  readonly config = input.required<CrudConfig>();
  /** Fixed filters and form values (parent id, the current tab). */
  readonly context = input<Record<string, string>>({});
  readonly child = input(false);

  private readonly api = inject(ContentApi);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly media = inject(MediaStore);
  private readonly store = inject(StaffSessionStore);
  protected readonly locale = inject(LocaleService);

  protected readonly rows = signal<ContentRow[]>([]);
  protected readonly total = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly busy = signal(false);
  protected readonly q = signal('');
  protected readonly announce = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly contextKey = computed(() => JSON.stringify(this.context()));

  protected readonly canReorder = computed(
    () => !!this.config().sortable && !this.q() && (this.total() ?? 0) <= PAGE,
  );
  protected readonly canDelete = computed(() => this.store.can(this.config().area));
  protected readonly reorderNote = computed(() =>
    this.config().sortable && this.rows().length > 1 && !this.child()
      ? this.q()
        ? 'admin.content.reorderSearch'
        : 'admin.content.reorderHint'
      : null,
  );

  constructor() {
    // Keyed by value: a parent passes a fresh context object on every render.
    effect(() => {
      this.config();
      this.contextKey();
      untracked(() => void this.load());
    });
    void this.media.ensure().catch(() => undefined);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const res = await firstValueFrom(
        this.api.list(this.config().endpoint, {
          ...this.context(),
          q: this.q() || null,
          limit: PAGE,
        }),
      );
      this.rows.set(res.data);
      this.total.set(res.total);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected isLive(row: ContentRow): boolean {
    return isLive(this.config(), row);
  }

  protected title(row: ContentRow): string {
    return rowTitle(this.config(), row, this.locale.lang());
  }

  protected subtitle(row: ContentRow): string {
    return this.config().secondary?.(row, this.locale.lang(), (k) => this.t.translate(k)) ?? '';
  }

  protected thumbOf(row: ContentRow, key: string): string | null {
    const asset = this.media.get(row[key] as string | null);
    return asset?.kind === 'image' ? mediaUrl(asset, 'thumb') : null;
  }

  protected childContext(parentKey: string, id: string): Record<string, string> {
    return { [parentKey]: id };
  }

  protected onSearch(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.q.set(value.trim());
      void this.load();
    }, 300);
  }

  private fail(error: unknown): void {
    this.toasts.show({
      kind: 'error',
      message: this.t.translate(problemMessageKey(toApiProblem(error))),
    });
  }

  private async openForm(data: CrudFormData): Promise<ContentRow | undefined> {
    const ref = this.dialogs.open<ContentRow, CrudFormData>(CrudForm, {
      data,
      ariaLabelledBy: 'crud-form-title',
      width: 'min(760px, calc(100vw - 32px))',
      disableClose: true,
    });
    return firstValueFrom(ref.closed);
  }

  protected async add(): Promise<void> {
    const saved = await this.openForm({ config: this.config(), context: this.context() });
    if (saved) {
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.saved') });
      await this.load();
    }
  }

  protected async edit(row: ContentRow): Promise<void> {
    const saved = await this.openForm({ config: this.config(), row, context: this.context() });
    if (saved) {
      this.rows.update((list) => list.map((r) => (r.id === row.id ? { ...r, ...saved } : r)));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.saved') });
    }
  }

  protected async remove(row: ContentRow): Promise<void> {
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.common.confirmDelete'),
      body: this.t.translate('admin.content.deleteConfirm', { title: this.title(row) }),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.remove(this.config().endpoint, row.id));
      this.rows.update((list) => list.filter((r) => r.id !== row.id));
      this.total.update((n) => (n === null ? n : n - 1));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.deleted') });
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async togglePublish(row: ContentRow): Promise<void> {
    const next = !this.isLive(row);
    this.busy.set(true);
    try {
      const saved =
        this.config().publish === 'field'
          ? await firstValueFrom(
              this.api.update(this.config().endpoint, row.id, { isPublished: next }),
            )
          : await firstValueFrom(this.api.publish(this.config().endpoint, row.id, next));
      this.rows.update((list) => list.map((r) => (r.id === row.id ? { ...r, ...saved } : r)));
      this.announce.set(
        `${this.title(row)}: ${this.t.translate(next ? 'admin.content.published' : 'admin.content.hidden')}`,
      );
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async setStatus(row: ContentRow, status: 'published' | 'hidden'): Promise<void> {
    this.busy.set(true);
    try {
      const saved = await firstValueFrom(this.api.testimonialStatus(row.id, status));
      // A status tab only lists its own status: the row moves out of view.
      const tab = this.context()['status'];
      this.rows.update((list) =>
        tab && tab !== status
          ? list.filter((r) => r.id !== row.id)
          : list.map((r) => (r.id === row.id ? { ...r, ...saved } : r)),
      );
      this.announce.set(
        `${this.title(row)}: ${this.t.translate(`admin.content.options.status.${status}`)}`,
      );
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected drop(event: CdkDragDrop<ContentRow[]>): void {
    if (event.previousIndex !== event.currentIndex)
      void this.move(event.previousIndex, event.currentIndex);
  }

  protected async move(from: number, to: number): Promise<void> {
    if (to < 0 || to >= this.rows().length) return;
    const before = this.rows();
    const { rows, body } = reorderedIds(before, from, to);
    this.rows.set(rows.map((r, i) => ({ ...r, sortOrder: i })));
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.reorder(this.config().endpoint, body));
      this.announce.set(
        this.t.translate('admin.content.moved', {
          title: this.title(before[from]),
          position: to + 1,
          total: rows.length,
        }),
      );
    } catch (error) {
      this.rows.set(before);
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }
}
