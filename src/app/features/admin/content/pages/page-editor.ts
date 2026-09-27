import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ContentApi, type ContentRow } from '../../../../core/api/admin/content-api';
import { problemMessageKey, toApiProblem } from '../../../../core/api/problem';
import { LocaleService } from '../../../../core/i18n/locale.service';
import { SeoService } from '../../../../core/seo/seo.service';
import { Button } from '../../../../shared/ui/button/button';
import { DialogService } from '../../../../shared/ui/dialog/dialog';
import { Icon } from '../../../../shared/ui/icon/icon';
import { AdminPageHead } from '../../layout/admin-page-head';
import { COLLECTIONS } from '../crud/collections';
import { pick } from '../crud/crud-config';
import { CrudForm, type CrudFormData } from '../crud/crud-form';
import { CrudList } from '../crud/crud-list';

/** CMS page slug → its public path (the site's routes; `home` is the root, `work` is /work-areas). */
export function publicPathOf(slug: string): string {
  return slug === 'home' ? '' : slug === 'work' ? '/work-areas' : `/${slug}`;
}

/**
 * One CMS page (prototype `aPageEditor`): its details (title, SEO, needs-review) and its ordered
 * sections, each with a visibility switch and a form (label, heading, Markdown body with preview,
 * two buttons, image). The API has no page preview: "view page" opens the published page.
 */
@Component({
  selector: 'app-page-editor',
  imports: [RouterLink, TranslocoPipe, Button, Icon, AdminPageHead, CrudList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      class="mb-3 inline-flex items-center gap-1 font-semibold text-secondary-text"
      [routerLink]="locale.link('/admin/pages')"
    >
      <app-icon name="arrow-left" [size]="18" />{{ 'admin.content.pages.back' | transloco }}
    </a>
    @if (page.error() && !page.hasValue()) {
      <p class="note note-warn" role="alert">{{ errorKey() | transloco }}</p>
    } @else if (page.value(); as p) {
      <app-admin-page-head
        [heading]="'admin.content.pages.editing' | transloco: { title: titleOf(p) }"
        [sub]="'/' + p['slug']"
      >
        <button
          pageActions
          appButton
          variant="line"
          size="sm"
          type="button"
          (click)="editDetails(p)"
        >
          <app-icon name="pencil" [size]="16" />{{ 'admin.content.pages.details' | transloco }}
        </button>
        <a
          pageActions
          appButton
          variant="line"
          size="sm"
          [href]="viewHref(p)"
          target="_blank"
          rel="noopener"
        >
          <app-icon name="external-link" [size]="16" />{{ 'admin.content.pages.view' | transloco }}
        </a>
      </app-admin-page-head>
      @if (p['needsReview'] === true) {
        <p class="note note-warn mb-4">{{ 'admin.content.pages.needsReviewNote' | transloco }}</p>
      }
      @if (p['isPublished'] === false) {
        <p class="note mb-4">{{ 'admin.content.pages.unpublishedNote' | transloco }}</p>
      }
      <p class="t-small mb-4 text-text-muted">
        {{ 'admin.content.pages.sectionsLead' | transloco }}
      </p>
      <app-crud-list [config]="sections" [context]="{ pageId: id() }" />
    } @else {
      <span class="skeleton block h-40" aria-hidden="true"></span>
    }
  `,
})
export class PageEditor {
  readonly id = input.required<string>();
  private readonly api = inject(ContentApi);
  private readonly dialogs = inject(DialogService);
  protected readonly locale = inject(LocaleService);
  protected readonly sections = COLLECTIONS['pageSections'];

  protected readonly page = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.get('pages', params),
  });
  protected readonly errorKey = computed(() => {
    const e = this.page.error();
    return e ? problemMessageKey(toApiProblem(e)) : 'admin.common.loadError';
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
  }

  protected titleOf(p: ContentRow): string {
    return pick(p, 'title', this.locale.lang());
  }

  protected viewHref(p: ContentRow): string {
    return this.locale.link(publicPathOf(String(p['slug'] ?? '')) || '/');
  }

  protected async editDetails(p: ContentRow): Promise<void> {
    const ref = this.dialogs.open<ContentRow, CrudFormData>(CrudForm, {
      data: { config: COLLECTIONS['pages'], row: p },
      ariaLabelledBy: 'crud-form-title',
      width: 'min(760px, calc(100vw - 32px))',
      disableClose: true,
    });
    const saved = await firstValueFrom(ref.closed);
    if (saved) this.page.set({ ...p, ...saved });
  }
}
