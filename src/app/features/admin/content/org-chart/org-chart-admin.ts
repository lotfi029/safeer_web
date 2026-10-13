import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ContentApi, type ContentRow } from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { LocaleService } from '../../../../core/i18n/locale.service';
import { SeoService } from '../../../../core/seo/seo.service';
import { DigitsPipe } from '../../../../shared/pipes/format';
import { Button } from '../../../../shared/ui/button/button';
import { DialogService } from '../../../../shared/ui/dialog/dialog';
import { Icon } from '../../../../shared/ui/icon/icon';
import { OrgChart } from '../../../../shared/ui/org-chart/org-chart';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { AdminPageHead } from '../../layout/admin-page-head';
import { confirmAction } from '../../shared/confirm-dialog';
import { ORG_POSITIONS } from '../crud/collections';
import { pick } from '../crud/crud-config';
import { CrudForm, type CrudFormData } from '../crud/crud-form';
import { flattenTree, ORG_MAX_DEPTH, previewForest } from './org-tree';

interface Usage {
  entity: string;
  id: string;
  label: string;
}

/**
 * «الهيكل التنظيمي» (content area), ported from ta3lom's job-titles screen: the positions as an
 * indented tree — a top-level position, «إضافة تابع» on any row, edit, show/hide, move up/down
 * among its siblings, delete (refused while sub-positions or members point at it, with the list) —
 * next to a live preview drawn by the same chart as the public page, from the same rules.
 */
@Component({
  selector: 'app-org-chart-admin',
  imports: [TranslocoPipe, DigitsPipe, Button, Icon, AdminPageHead, OrgChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head [heading]="'admin.content.orgChart.title' | transloco" />
    <p class="note mb-6 flex items-start gap-2">
      <app-icon name="info" class="shrink-0" />{{ 'admin.content.orgChart.note' | transloco }}
    </p>

    <div class="grid items-start gap-8 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section class="flex flex-col gap-4" aria-labelledby="org-tree-title">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="t-h4 m-0 text-heading" id="org-tree-title">
            {{ 'admin.content.orgChart.tree' | transloco }}
            <span class="t-small font-normal text-text-muted">({{ rows().length | digits }})</span>
          </h2>
          <button appButton size="sm" type="button" [disabled]="busy()" (click)="add(null)">
            <app-icon name="plus" [size]="18" />{{ 'admin.content.orgChart.addRoot' | transloco }}
          </button>
        </div>

        @if (usages(); as u) {
          <div class="note note-warn flex-col items-start" role="alert" data-testid="org-in-use">
            <p class="m-0 font-semibold">
              {{ 'admin.content.orgChart.inUse' | transloco: { title: usageTitle() } }}
            </p>
            <ul class="m-0 ps-5">
              @for (x of u; track x.entity + x.id) {
                <li>
                  {{ 'admin.content.orgChart.usage.' + x.entity | transloco }}:
                  <bdi>{{ x.label }}</bdi>
                </li>
              }
            </ul>
          </div>
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
          <p class="t-muted card m-0">{{ 'admin.content.empty' | transloco }}</p>
        } @else {
          <ol class="m-0 flex list-none flex-col gap-2 p-0" data-testid="org-rows">
            @for (item of tree(); track item.row.id) {
              <li
                class="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-3"
                [style.margin-inline-start.rem]="item.depth * 1.5"
                [attr.data-row]="item.row.id"
              >
                <div class="flex min-w-0 flex-1 basis-40 flex-col">
                  <span class="font-semibold text-heading" dir="auto" data-testid="row-title">{{
                    name(item.row)
                  }}</span>
                  <span class="t-small text-text-muted">
                    @if (item.row['isPublished'] === false) {
                      {{ 'admin.content.hidden' | transloco }} ·
                    }
                    {{
                      'admin.content.orgChart.holders' | transloco: { count: holderCount(item.row) }
                    }}
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-1">
                  <button
                    appButton
                    variant="soft"
                    size="sm"
                    type="button"
                    [disabled]="busy() || item.depth + 1 >= maxDepth"
                    [attr.title]="
                      item.depth + 1 >= maxDepth
                        ? ('admin.content.orgChart.depthLimit' | transloco)
                        : null
                    "
                    [attr.aria-label]="
                      'admin.content.orgChart.addChildTo' | transloco: { title: name(item.row) }
                    "
                    (click)="add(item.row)"
                  >
                    <app-icon name="plus" [size]="16" />{{
                      'admin.content.orgChart.addChild' | transloco
                    }}
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="busy() || !canMove(item.row, -1)"
                    [attr.aria-label]="('admin.content.moveUp' | transloco) + ': ' + name(item.row)"
                    (click)="move(item.row, -1)"
                  >
                    <app-icon name="arrow-up" [size]="18" />
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="busy() || !canMove(item.row, 1)"
                    [attr.aria-label]="
                      ('admin.content.moveDown' | transloco) + ': ' + name(item.row)
                    "
                    (click)="move(item.row, 1)"
                  >
                    <app-icon name="arrow-down" [size]="18" />
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="busy()"
                    [attr.aria-label]="
                      ('admin.content.editShort' | transloco) + ': ' + name(item.row)
                    "
                    (click)="edit(item.row)"
                  >
                    <app-icon name="pencil" [size]="18" />
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="busy()"
                    [attr.aria-label]="('admin.common.delete' | transloco) + ': ' + name(item.row)"
                    (click)="remove(item.row)"
                  >
                    <app-icon name="trash-2" [size]="18" />
                  </button>
                </div>
              </li>
            }
          </ol>
        }
        <p class="sr-only" aria-live="polite">{{ announce() }}</p>
      </section>

      <section class="card flex min-w-0 flex-col gap-4" aria-labelledby="org-preview-title">
        <div>
          <h2 class="t-h4 m-0 text-heading" id="org-preview-title">
            {{ 'admin.content.orgChart.preview' | transloco }}
          </h2>
          <p class="t-small m-0 text-text-muted">
            {{ 'admin.content.orgChart.previewNote' | transloco }}
          </p>
        </div>
        @if (preview().length) {
          <app-org-chart [nodes]="preview()" />
        } @else {
          <p class="t-muted m-0">{{ 'admin.content.orgChart.previewEmpty' | transloco }}</p>
        }
      </section>
    </div>
  `,
})
export class OrgChartAdmin {
  private readonly api = inject(ContentApi);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly locale = inject(LocaleService);

  protected readonly maxDepth = ORG_MAX_DEPTH;
  protected readonly rows = signal<ContentRow[]>([]);
  private readonly members = signal<ContentRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly busy = signal(false);
  protected readonly announce = signal('');
  protected readonly usages = signal<Usage[] | null>(null);
  protected readonly usageTitle = signal('');

  protected readonly tree = computed(() => flattenTree(this.rows()));
  protected readonly preview = computed(() =>
    previewForest(this.rows(), this.members(), this.locale.lang()),
  );

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    void this.load();
  }

  protected name(row: ContentRow): string {
    return pick(row, 'name', this.locale.lang()) || `#${row.id}`;
  }

  protected holderCount(row: ContentRow): number {
    return this.members().filter((m) => String(m['orgPositionId'] ?? '') === String(row.id)).length;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const [positions, members] = await Promise.all([
        firstValueFrom(this.api.list(ORG_POSITIONS.endpoint, { limit: 100 })),
        firstValueFrom(this.api.list('board', { limit: 100 })),
      ]);
      this.rows.set(positions.data);
      this.members.set(members.data);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
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

  protected async add(parent: ContentRow | null): Promise<void> {
    const saved = await this.openForm({
      config: ORG_POSITIONS,
      context: { parentId: parent ? String(parent.id) : '' },
    });
    if (saved) await this.saved();
  }

  protected async edit(row: ContentRow): Promise<void> {
    if (await this.openForm({ config: ORG_POSITIONS, row })) await this.saved();
  }

  private async saved(): Promise<void> {
    this.usages.set(null);
    this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.saved') });
    await this.load();
  }

  private siblings(row: ContentRow): ContentRow[] {
    const parent = row['parentId'] ?? null;
    return this.tree()
      .map((i) => i.row)
      .filter((r) => (r['parentId'] ?? null) === parent);
  }

  protected canMove(row: ContentRow, step: -1 | 1): boolean {
    const list = this.siblings(row);
    const at = list.findIndex((r) => r.id === row.id);
    return at + step >= 0 && at + step < list.length;
  }

  /** Swaps a position with its neighbour among its siblings; the whole sibling row is renumbered. */
  protected async move(row: ContentRow, step: -1 | 1): Promise<void> {
    const list = this.siblings(row);
    const from = list.findIndex((r) => r.id === row.id);
    const to = from + step;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    const body = next.map((r, i) => ({ id: String(r.id), sortOrder: i }));
    const before = this.rows();
    const order = new Map(body.map((b) => [b.id, b.sortOrder]));
    this.rows.set(
      before.map((r) =>
        order.has(String(r.id)) ? { ...r, sortOrder: order.get(String(r.id)) } : r,
      ),
    );
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.reorder(ORG_POSITIONS.endpoint, body));
      this.announce.set(
        this.t.translate('admin.content.moved', {
          title: this.name(row),
          position: to + 1,
          total: list.length,
        }),
      );
    } catch (error) {
      this.rows.set(before);
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(row: ContentRow): Promise<void> {
    const ok = await confirmAction(this.dialogs, {
      heading: this.t.translate('admin.common.confirmDelete'),
      body: this.t.translate('admin.content.deleteConfirm', { title: this.name(row) }),
      confirm: this.t.translate('admin.common.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.usages.set(null);
    try {
      await firstValueFrom(this.api.remove(ORG_POSITIONS.endpoint, row.id));
      this.rows.update((list) => list.filter((r) => r.id !== row.id));
      this.toasts.show({ kind: 'success', message: this.t.translate('admin.content.deleted') });
    } catch (error) {
      const problem = toApiProblem(error);
      if (problem.code === 'RESOURCE_IN_USE') {
        this.usageTitle.set(this.name(row));
        this.usages.set((problem.extra['usages'] as Usage[] | undefined) ?? []);
      } else {
        this.fail(error);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private fail(error: unknown): void {
    this.toasts.show({
      kind: 'error',
      message: this.t.translate(problemMessageKey(toApiProblem(error))),
    });
  }
}
