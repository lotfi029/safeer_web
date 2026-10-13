import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { OrgNode } from '../../../core/api/models';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { ABOUT_PATHS } from '../../../core/site/about';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { OrgChart } from '../../../shared/ui/org-chart/org-chart';
import { PageHead } from '../../../shared/ui/page-head/page-head';

/**
 * The organisational structure (`/:lang/about/org-structure`, «من نحن» → «الهيكل التنظيمي»), like
 * ta3lom's: the published positions as a chart, each with the names of the members who hold it.
 */
@Component({
  selector: 'app-org-structure-page',
  imports: [TranslocoPipe, PageState, PageHead, EmptyState, OrgChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as nodes) {
      <app-page-head
        [title]="'pages.orgStructure.title' | transloco"
        [lead]="'pages.orgStructure.lede' | transloco"
        [breadcrumb]="breadcrumb()"
      />
      <section class="section">
        <div class="wrap">
          @if (nodes.length) {
            <app-org-chart [nodes]="nodes" />
          } @else {
            <div class="card">
              <app-empty-state icon="building-2" [body]="'pages.orgStructure.empty' | transloco" />
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class OrgStructurePage {
  readonly data = input.required<Loaded<OrgNode[]>>();
  private readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);
  private readonly seo = inject(SeoService);

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.t.translate('shell.footer.about'), link: this.locale.link(ABOUT_PATHS.about) },
    { label: this.t.translate('pages.orgStructure.title') },
  ]);

  constructor() {
    effect(() => {
      if (!this.data().data) return;
      this.seo.set({
        title: this.t.translate('pages.orgStructure.title'),
        description: this.t.translate('pages.orgStructure.lede'),
        path: ABOUT_PATHS.orgStructure,
        lang: this.locale.lang(),
      });
    });
  }
}
