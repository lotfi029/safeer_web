import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Asset, DocSectionResponse } from '../../../core/api/models';
import { fileUrl } from '../../../core/api/public-api';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { GOVERNANCE_PATHS, LICENCE_DETAILS_SECTION } from '../../../core/site/governance';
import { SiteStore } from '../../../core/site/site.store';
import { FileSizePipe, LocalDatePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { GovernanceNav } from './governance-nav';

export { governanceSectionResolver } from './governance.resolvers';

/** Short type label from the MIME type: application/pdf → PDF, image/png → PNG. */
function typeLabel(asset: Asset): string {
  const sub = asset.mimeType?.split('/')[1]?.split(/[;+.-]/)[0] ?? '';
  return /^[a-z0-9]{2,5}$/i.test(sub) ? sub.toUpperCase() : '';
}

/**
 * A governance section (`/:lang/governance/:slug`, ta3lom's document-section page): the section name
 * as the h1 and a fixed lede, the governance nav, then the section's documents (title, meta line,
 * date, file type and size, a download link to `/files/<publicId>`, or «قريبًا» when the file isn't
 * published yet). The bylaws section adds the licence details from the site settings.
 */
@Component({
  selector: 'app-governance-section-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FileSizePipe,
    LocalDatePipe,
    PageState,
    PageHead,
    Button,
    EmptyState,
    Icon,
    Reveal,
    GovernanceNav,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as d) {
      <app-page-head
        [title]="d.category.name"
        [lead]="'pages.governance.lede' | transloco"
        [breadcrumb]="breadcrumb()"
      />

      <div class="section">
        <div class="wrap grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <app-governance-nav [active]="d.category.slug" />

          <div
            class="grid min-w-0 gap-8"
            [class]="licence() ? 'xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start' : ''"
          >
            @if (documents().length) {
              <ul class="m-0 flex list-none flex-col gap-4 p-0" data-testid="governance-documents">
                @for (doc of documents(); track doc.id; let i = $index) {
                  <li
                    appReveal
                    [revealIndex]="i"
                    class="card flex flex-wrap items-center gap-4 !px-6 !py-5 sm:flex-nowrap"
                    [class.card-hover]="!!doc.asset"
                  >
                    <span class="icon-tile size-12 rounded-xl">
                      <app-icon name="file-text" [size]="23" />
                    </span>
                    <div class="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                      <h2 class="text-base leading-relaxed font-bold text-heading">
                        {{ doc.title || ('common.placeholder' | transloco) }}
                      </h2>
                      @if (doc.meta) {
                        <p class="t-small m-0 text-text">{{ doc.meta }}</p>
                      }
                      @let size = doc.asset?.sizeBytes ? (doc.asset?.sizeBytes | fileSize) : '';
                      @let line = join([doc.docDate | localDate, typeOf(doc.asset), size]);
                      @if (line) {
                        <p class="t-caption m-0">{{ line }}</p>
                      }
                    </div>
                    @if (doc.asset; as a) {
                      <a
                        appButton
                        variant="line"
                        size="sm"
                        class="shrink-0"
                        [href]="fileHref(a.publicId)"
                        download
                      >
                        <app-icon name="download" [size]="18" />
                        {{ 'common.download' | transloco }}
                        <span class="sr-only">{{ doc.title }}</span>
                      </a>
                    } @else {
                      <span class="pill pill-plain shrink-0" data-testid="doc-soon">
                        <app-icon name="clock" [size]="14" />
                        {{ 'pages.governance.soon' | transloco }}
                        <span class="sr-only">: {{ 'pages.governance.soonHint' | transloco }}</span>
                      </span>
                    }
                  </li>
                }
              </ul>
            } @else {
              <div class="card">
                <app-empty-state icon="file-text" [body]="'pages.governance.empty' | transloco" />
              </div>
            }

            @if (licence(); as l) {
              <aside
                class="card flex flex-col gap-4 xl:sticky xl:top-24"
                aria-labelledby="licence-details"
                data-testid="licence-details"
              >
                <h2 class="t-h4 m-0 text-heading" id="licence-details">
                  {{ 'pages.governance.licenceDetails' | transloco }}
                </h2>
                <dl class="m-0 flex flex-col gap-3">
                  @if (l.number) {
                    <div class="flex flex-col gap-0.5">
                      <dt class="t-caption">{{ 'pages.governance.licenceNo' | transloco }}</dt>
                      <dd class="m-0 font-bold text-heading">
                        <bdi dir="ltr">{{ l.number }}</bdi>
                      </dd>
                    </div>
                  }
                  @if (l.issuer) {
                    <div class="flex flex-col gap-0.5">
                      <dt class="t-caption">{{ 'pages.governance.issuer' | transloco }}</dt>
                      <dd class="m-0 font-semibold text-heading">{{ l.issuer }}</dd>
                    </div>
                  }
                </dl>
                <a class="font-semibold" [routerLink]="locale.link(licencesPath)">{{
                  'pages.governance.allLicences' | transloco
                }}</a>
              </aside>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class GovernanceSectionPage {
  readonly data = input.required<Loaded<DocSectionResponse>>();
  protected readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);
  private readonly site = inject(SiteStore);
  private readonly seo = inject(SeoService);
  protected readonly licencesPath = GOVERNANCE_PATHS.licences;

  protected readonly documents = computed(() =>
    (this.data().data?.documents ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
  );

  /** Licence number + issuer from the site settings, on the bylaws section only (hidden if unset). */
  protected readonly licence = computed(() => {
    if (this.data().data?.category.slug !== LICENCE_DETAILS_SECTION) return null;
    const s = this.site.site()?.settings;
    const number = s?.licenceNo?.trim() || null;
    const issuer = s?.licenceIssuer?.trim() || null;
    return number || issuer ? { number, issuer } : null;
  });

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    {
      label: this.t.translate('pages.governance.title'),
      link: this.locale.link(GOVERNANCE_PATHS.root),
    },
    { label: this.data().data?.category.name ?? '' },
  ]);

  constructor() {
    effect(() => {
      const d = this.data().data;
      if (!d) return;
      this.seo.set({
        title: d.category.name,
        description: this.t.translate('pages.governance.lede'),
        path: GOVERNANCE_PATHS.section(d.category.slug),
        lang: this.locale.lang(),
      });
    });
  }

  protected fileHref(publicId: string): string {
    return fileUrl(publicId);
  }

  protected typeOf(asset: Asset | null): string {
    return asset ? typeLabel(asset) : '';
  }

  /** "3 May 2024 · PDF · 1.2 MB" — unknown parts (and a 0-byte size) are left out. */
  protected join(parts: string[]): string {
    return parts.filter(Boolean).join(' · ');
  }
}
