import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../../../core/i18n/locale.service';
import { SeoService } from '../../../../core/seo/seo.service';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AdminPageHead } from '../../layout/admin-page-head';
import { COLLECTIONS } from './collections';
import type { CrudConfig } from './crud-config';
import { CrudList } from './crud-list';

/**
 * A content screen made of CRUD collections (route data `collections: ['themes', 'testimonials']`,
 * `title`, optional `note`). A collection with tabs (board groups, about-item kinds, testimonial
 * statuses, partner categories) filters by `?<param>=` and fixes that value in its form.
 */
@Component({
  selector: 'app-crud-page',
  imports: [RouterLink, TranslocoPipe, Icon, AdminPageHead, CrudList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head [heading]="'admin.content.' + title() + '.title' | transloco" />
    @if (note(); as n) {
      <p class="note mb-6 flex items-start gap-2">
        <app-icon name="info" class="shrink-0" />{{ 'admin.content.' + n | transloco }}
      </p>
    }
    <div class="flex flex-col gap-10">
      @for (c of configs(); track c.id) {
        <section class="flex flex-col gap-4">
          @if (c.tabs; as tabs) {
            <nav
              class="flex flex-wrap gap-2"
              [attr.aria-label]="'admin.content.' + c.id + '.tabs' | transloco"
            >
              @if (!tabRequired(c)) {
                <a
                  class="chip"
                  [routerLink]="[]"
                  [queryParams]="{ tab: null }"
                  [attr.aria-current]="!tabValue(c) ? 'page' : null"
                  >{{ 'admin.content.all' | transloco }}</a
                >
              }
              @for (v of tabs.values; track v) {
                <a
                  class="chip"
                  [routerLink]="[]"
                  [queryParams]="{ tab: v }"
                  [attr.aria-current]="tabValue(c) === v ? 'page' : null"
                  >{{ tabs.label + '.' + v | transloco }}</a
                >
              }
            </nav>
          }
          <app-crud-list [config]="c" [context]="contextOf(c)" />
        </section>
      }
    </div>
  `,
})
export class CrudPage {
  /** Route data. */
  readonly collections = input.required<string[]>();
  readonly title = input.required<string>();
  readonly note = input<string | null>(null);
  /** Query param `?tab=`. */
  readonly tab = input<string | null>(null);

  private readonly locale = inject(LocaleService);
  protected readonly configs = computed(() =>
    this.collections()
      .map((id) => COLLECTIONS[id])
      .filter(Boolean),
  );

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  /** Board members and about items always belong to one group, so there's no "all" tab. */
  protected tabRequired(c: CrudConfig): boolean {
    return c.fields.some((f) => f.key === c.tabs?.param && f.hidden);
  }

  protected tabValue(c: CrudConfig): string | null {
    const t = this.tab();
    if (t && c.tabs?.values.includes(t)) return t;
    return this.tabRequired(c) ? (c.tabs?.values[0] ?? null) : null;
  }

  protected contextOf(c: CrudConfig): Record<string, string> {
    const v = this.tabValue(c);
    return v && c.tabs ? { [c.tabs.param]: v } : {};
  }
}
