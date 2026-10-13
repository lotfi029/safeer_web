import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Licence } from '../../../core/api/models';
import { fileUrl } from '../../../core/api/public-api';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { GOVERNANCE_PATHS, licenceStatus, riyadhToday } from '../../../core/site/governance';
import { formatDate } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { GovernanceNav } from './governance-nav';

export { licencesResolver } from './governance.resolvers';

/**
 * Licences (`/:lang/governance/licences`, ta3lom's licensing page): the primary licence as a band
 * (title, number, issuer, dates, view/download), then a card per licence with its valid/expired
 * status (expiry date against today in Riyadh). Numbers and dates use Western digits in both
 * languages, so a licence number reads the same as on the paper.
 */
@Component({
  selector: 'app-licences-page',
  imports: [TranslocoPipe, PageState, PageHead, Button, EmptyState, Icon, Reveal, GovernanceNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data) {
      <app-page-head
        [title]="'pages.governance.licences' | transloco"
        [lead]="'pages.governance.licencesLede' | transloco"
        [breadcrumb]="breadcrumb()"
      />

      <div class="section">
        <div class="wrap grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <app-governance-nav active="licences" />

          <div class="flex min-w-0 flex-col gap-10">
            @if (primary(); as p) {
              <article
                class="card band flex flex-col gap-6 border-0 md:flex-row md:items-end md:justify-between"
                aria-labelledby="primary-licence"
                data-testid="primary-licence"
              >
                <div class="flex min-w-0 flex-col gap-3">
                  <p class="t-eyebrow m-0">{{ 'pages.governance.primary' | transloco }}</p>
                  <h2 class="t-h3 m-0" id="primary-licence">{{ p.title }}</h2>
                  @if (p.number) {
                    <p class="m-0 text-2xl font-bold">
                      <span class="sr-only">{{ 'pages.governance.licenceNo' | transloco }}: </span>
                      <bdi dir="ltr">{{ p.number }}</bdi>
                    </p>
                  }
                  <dl class="m-0 flex flex-wrap gap-x-8 gap-y-2 text-band-soft">
                    @if (p.issuer) {
                      <div>
                        <dt class="t-caption text-band-soft">
                          {{ 'pages.governance.issuer' | transloco }}
                        </dt>
                        <dd class="m-0 font-semibold text-band-text">{{ p.issuer }}</dd>
                      </div>
                    }
                    @if (p.issuedOn) {
                      <div>
                        <dt class="t-caption text-band-soft">
                          {{ 'pages.governance.issuedOn' | transloco }}
                        </dt>
                        <dd class="m-0 font-semibold text-band-text">{{ date(p.issuedOn) }}</dd>
                      </div>
                    }
                    @if (p.expiresOn) {
                      <div>
                        <dt class="t-caption text-band-soft">
                          {{ 'pages.governance.expiresOn' | transloco }}
                        </dt>
                        <dd class="m-0 font-semibold text-band-text">{{ date(p.expiresOn) }}</dd>
                      </div>
                    }
                  </dl>
                  @if (status(p); as st) {
                    <span
                      class="pill self-start"
                      [class.pill-ok]="st === 'valid'"
                      [class.pill-warn]="st === 'expired'"
                      >{{ 'pages.governance.' + st | transloco }}</span
                    >
                  }
                </div>
                @if (p.asset; as a) {
                  <div class="flex shrink-0 flex-wrap gap-3">
                    <a
                      appButton
                      variant="onband"
                      size="sm"
                      [href]="href(a.publicId)"
                      target="_blank"
                      rel="noopener"
                    >
                      <app-icon name="eye" [size]="18" />{{ 'pages.governance.view' | transloco }}
                      <span class="sr-only">{{ p.title }}</span>
                    </a>
                    <a appButton variant="onband" size="sm" [href]="href(a.publicId)" download>
                      <app-icon name="download" [size]="18" />{{ 'common.download' | transloco }}
                      <span class="sr-only">{{ p.title }}</span>
                    </a>
                  </div>
                }
              </article>
            }

            @if (licences().length) {
              <section class="flex flex-col gap-5" aria-labelledby="all-licences">
                <h2 class="t-h3 m-0" id="all-licences">
                  {{ 'pages.governance.allTitle' | transloco }}
                </h2>
                <ul
                  class="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2"
                  data-testid="licence-cards"
                >
                  @for (l of licences(); track l.id; let i = $index) {
                    <li appReveal [revealIndex]="i" class="card flex flex-col gap-4">
                      <div class="flex items-start gap-4">
                        <span class="icon-tile size-12 rounded-xl">
                          <app-icon name="badge-check" [size]="23" />
                        </span>
                        <div class="flex min-w-0 flex-1 flex-col gap-2">
                          <h3 class="text-base leading-relaxed font-bold text-heading">
                            {{ l.title || ('common.placeholder' | transloco) }}
                          </h3>
                          <div class="flex flex-wrap gap-2">
                            @if (l.isPrimary) {
                              <span class="pill pill-solid">{{
                                'pages.governance.primary' | transloco
                              }}</span>
                            }
                            @if (status(l); as st) {
                              <span
                                class="pill"
                                [class.pill-ok]="st === 'valid'"
                                [class.pill-warn]="st === 'expired'"
                                data-testid="licence-status"
                                >{{ 'pages.governance.' + st | transloco }}</span
                              >
                            }
                          </div>
                        </div>
                      </div>
                      <dl class="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        @if (l.number) {
                          <div>
                            <dt class="t-caption">{{ 'pages.governance.number' | transloco }}</dt>
                            <dd class="m-0 font-semibold text-heading">
                              <bdi dir="ltr">{{ l.number }}</bdi>
                            </dd>
                          </div>
                        }
                        @if (l.issuer) {
                          <div>
                            <dt class="t-caption">{{ 'pages.governance.issuer' | transloco }}</dt>
                            <dd class="m-0 font-semibold text-heading">{{ l.issuer }}</dd>
                          </div>
                        }
                        @if (l.issuedOn) {
                          <div>
                            <dt class="t-caption">{{ 'pages.governance.issuedOn' | transloco }}</dt>
                            <dd class="m-0 font-semibold text-heading">{{ date(l.issuedOn) }}</dd>
                          </div>
                        }
                        @if (l.expiresOn) {
                          <div>
                            <dt class="t-caption">
                              {{ 'pages.governance.expiresOn' | transloco }}
                            </dt>
                            <dd class="m-0 font-semibold text-heading">{{ date(l.expiresOn) }}</dd>
                          </div>
                        }
                      </dl>
                      @if (l.asset; as a) {
                        <div class="mt-auto flex flex-wrap gap-3">
                          <a
                            appButton
                            variant="line"
                            size="sm"
                            [href]="href(a.publicId)"
                            target="_blank"
                            rel="noopener"
                          >
                            <app-icon name="eye" [size]="18" />{{
                              'pages.governance.view' | transloco
                            }}
                            <span class="sr-only">{{ l.title }}</span>
                          </a>
                          <a appButton variant="soft" size="sm" [href]="href(a.publicId)" download>
                            <app-icon name="download" [size]="18" />{{
                              'common.download' | transloco
                            }}
                            <span class="sr-only">{{ l.title }}</span>
                          </a>
                        </div>
                      } @else {
                        <span class="pill pill-plain mt-auto self-start">{{
                          'pages.governance.soon' | transloco
                        }}</span>
                      }
                    </li>
                  }
                </ul>
              </section>
            } @else {
              <div class="card">
                <app-empty-state
                  icon="badge-check"
                  [body]="'pages.governance.noLicences' | transloco"
                />
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class LicencesPage {
  readonly data = input.required<Loaded<Licence[]>>();
  protected readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);
  private readonly seo = inject(SeoService);
  private readonly today = riyadhToday();

  protected readonly licences = computed(() => this.data().data ?? []);
  /** The flagged licence (the API sorts it first); none if no licence is flagged. */
  protected readonly primary = computed(() => this.licences().find((l) => l.isPrimary) ?? null);

  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    {
      label: this.t.translate('pages.governance.title'),
      link: this.locale.link(GOVERNANCE_PATHS.root),
    },
    { label: this.t.translate('pages.governance.licences') },
  ]);

  constructor() {
    effect(() => {
      if (!this.data().data) return;
      this.seo.set({
        title: this.t.translate('pages.governance.licences'),
        description: this.t.translate('pages.governance.licencesLede'),
        path: GOVERNANCE_PATHS.licences,
        lang: this.locale.lang(),
      });
    });
  }

  protected href(publicId: string): string {
    return fileUrl(publicId);
  }

  protected status(l: Licence): 'valid' | 'expired' | null {
    return licenceStatus(l.expiresOn, this.today);
  }

  /** Gregorian, Western digits in both languages (`10 مارس 2019` / `10 March 2019`). */
  protected date(value: string): string {
    return formatDate(
      value,
      'long',
      this.locale.lang() === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB',
    );
  }
}
