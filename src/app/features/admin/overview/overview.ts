import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AdminOverview } from '../../../core/api/models';
import { StaffSessionStore } from '../../../core/auth/staff-session.store';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { DigitsPipe, LocalDatePipe, RelTimePipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';
import type { IconName } from '../../../shared/ui/icon/icon-names';
import { StatusPill } from '../../../shared/ui/status-pill/status-pill';
import { AdminBadges } from '../layout/admin-badges';
import { AdminPageHead } from '../layout/admin-page-head';
import { SeriesChart } from './series-chart';

type StatKey = keyof AdminOverview['statCards'];

const STATS: readonly { key: StatKey; icon: IconName }[] = [
  { key: 'newApplications', icon: 'file' },
  { key: 'underReview', icon: 'clock' },
  { key: 'acceptedThisMonth', icon: 'check' },
  { key: 'unreadMessages', icon: 'mail' },
];

/**
 * Overview (prototype `aOverview`, C20/A5). Every block is shown only when the role's response has it:
 * application figures, the chart and the latest applications for admin/reviewer; unread messages for
 * admin/support; content alerts for everyone; recent activity for admins (area `audit`).
 */
@Component({
  selector: 'app-admin-overview',
  imports: [
    RouterLink,
    TranslocoPipe,
    DigitsPipe,
    LocalDatePipe,
    RelTimePipe,
    Button,
    Icon,
    StatusPill,
    AdminPageHead,
    SeriesChart,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-page-head
      [heading]="'admin.overview.title' | transloco"
      [sub]="
        loadedAt()
          ? ('admin.common.updated' | transloco: { time: (loadedAt() | localDate: 'datetime') })
          : null
      "
    >
      <button pageActions appButton variant="line" size="sm" type="button" (click)="load()">
        <app-icon name="refresh-cw" [size]="18" />
        {{ 'admin.common.refresh' | transloco }}
      </button>
    </app-admin-page-head>

    @if (error()) {
      <div class="note note-warn mb-6" role="alert">
        <app-icon name="circle-alert" />
        <p class="m-0">{{ 'admin.common.loadError' | transloco }}</p>
        <button appButton variant="line" size="sm" type="button" (click)="load()">
          {{ 'common.retry' | transloco }}
        </button>
      </div>
    }

    @if (data(); as o) {
      <div class="flex flex-col gap-6">
        @if (stats().length) {
          <ul
            class="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4"
            data-testid="stat-cards"
          >
            @for (s of stats(); track s.key) {
              <li class="card flex flex-col gap-2" [attr.data-stat]="s.key">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-text-muted">{{
                    'admin.overview.stats.' + s.key + '.label' | transloco
                  }}</span>
                  <span class="icon-tile size-10" aria-hidden="true"
                    ><app-icon [name]="s.icon" [size]="19"
                  /></span>
                </div>
                <strong class="t-h2 m-0 text-heading">{{ s.value | digits }}</strong>
                <span class="t-caption text-text-muted">{{
                  'admin.overview.stats.' + s.key + '.hint' | transloco
                }}</span>
              </li>
            }
          </ul>
        }

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          @if (o.series?.length) {
            <section class="card">
              <app-series-chart [series]="o.series!" />
            </section>
          }
          <section
            class="card flex flex-col gap-4"
            [class.lg:col-span-2]="!o.series?.length"
            aria-labelledby="alerts-title"
          >
            <h2 class="t-h4 m-0 text-heading" id="alerts-title">
              {{ 'admin.overview.alerts.title' | transloco }}
            </h2>
            @if (alerts().length) {
              <ul class="m-0 flex list-none flex-col gap-3 p-0">
                @for (a of alerts(); track a.key) {
                  <li class="note note-warn m-0">
                    <app-icon name="triangle-alert" />
                    <p class="m-0">
                      {{
                        'admin.overview.alerts.' + a.key | transloco: { count: (a.count | digits) }
                      }}
                    </p>
                  </li>
                }
              </ul>
            } @else {
              <p class="t-muted m-0">{{ 'admin.overview.alerts.none' | transloco }}</p>
            }
            @if (canContent()) {
              <h2 class="t-h4 m-0 mt-2 text-heading">
                {{ 'admin.overview.quick.title' | transloco }}
              </h2>
              <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="quick-actions">
                @for (q of quick; track q.key) {
                  <li>
                    <a
                      class="tile flex min-h-12 items-center gap-3 font-semibold text-heading no-underline"
                      [routerLink]="locale.link(q.path)"
                      [queryParams]="q.query"
                    >
                      <app-icon name="plus" [size]="18" />{{
                        'admin.overview.quick.' + q.key | transloco
                      }}
                    </a>
                  </li>
                }
              </ul>
            }
          </section>
        </div>

        @if (o.latestApplications; as latest) {
          <section class="card flex flex-col gap-4" aria-labelledby="latest-title">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="t-h4 m-0 text-heading" id="latest-title">
                {{ 'admin.overview.latest.title' | transloco }}
              </h2>
              <a class="font-semibold" [routerLink]="locale.link('/admin/applications')">{{
                'admin.overview.latest.viewAll' | transloco
              }}</a>
            </div>
            @if (latest.length) {
              <ul class="m-0 flex list-none flex-col p-0" data-testid="latest-applications">
                @for (a of latest; track a.id) {
                  <li class="border-t border-border first:border-t-0">
                    <a
                      class="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-text no-underline hover:bg-raise md:px-2"
                      [routerLink]="locale.link('/admin/applications/' + a.id)"
                    >
                      <strong class="text-heading" dir="ltr">{{ a.reference }}</strong>
                      <span class="min-w-0 flex-1 truncate">{{
                        a.name || ('common.missingValue' | transloco)
                      }}</span>
                      <span class="t-small text-text-muted">{{
                        a.submittedAt | localDate: 'medium'
                      }}</span>
                      <app-status-pill [status]="a.status" />
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <p class="t-muted m-0">{{ 'admin.overview.latest.empty' | transloco }}</p>
            }
          </section>
        }

        @if (showAudit()) {
          <section class="card flex flex-col gap-4" aria-labelledby="audit-title">
            <h2 class="t-h4 m-0 text-heading" id="audit-title">
              {{ 'admin.overview.audit.title' | transloco }}
            </h2>
            @if (o.recentAuditLog.length) {
              <ul class="m-0 flex list-none flex-col gap-3 p-0" data-testid="recent-audit">
                @for (e of o.recentAuditLog; track e.id) {
                  <li class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span class="font-semibold text-heading">{{ e.action }}</span>
                    <span class="min-w-0 break-words"
                      >{{ e.entityType }}{{ e.entityLabel ? ' · ' + e.entityLabel : '' }}</span
                    >
                    <span class="t-small text-text-muted"
                      >{{ e.actorName || ('admin.common.system' | transloco) }} ·
                      {{ e.createdAt | relTime }}</span
                    >
                  </li>
                }
              </ul>
            } @else {
              <p class="t-muted m-0">{{ 'admin.overview.audit.empty' | transloco }}</p>
            }
          </section>
        }
      </div>
    } @else if (!error()) {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="card flex flex-col gap-3">
            <span class="skeleton h-5 w-2/3"></span>
            <span class="skeleton h-9 w-1/3"></span>
          </div>
        }
      </div>
      <p class="sr-only" role="status">{{ 'common.loading' | transloco }}</p>
    }
  `,
})
export class AdminOverviewPage {
  protected readonly locale = inject(LocaleService);
  private readonly badges = inject(AdminBadges);
  private readonly store = inject(StaffSessionStore);

  protected readonly data = signal<AdminOverview | null>(null);
  protected readonly error = signal(false);
  protected readonly loadedAt = signal<Date | null>(null);

  protected readonly stats = computed(() => {
    const cards = this.data()?.statCards ?? {};
    return STATS.filter((s) => typeof cards[s.key] === 'number').map((s) => ({
      ...s,
      value: cards[s.key] as number,
    }));
  });

  protected readonly alerts = computed(() => {
    const a = this.data()?.contentAlerts;
    if (!a) return [];
    return [
      { key: 'noPartners', count: 0, on: a.noPublishedPartners },
      { key: 'legacyPosts', count: a.legacyPostsCount, on: a.legacyPostsCount > 0 },
      { key: 'pagesReview', count: a.pagesNeedingReviewCount, on: a.pagesNeedingReviewCount > 0 },
    ].filter((x) => x.on);
  });

  protected readonly showAudit = computed(() => this.store.can('audit'));
  protected readonly canContent = computed(() => this.store.can('content'));
  /** Prototype "quick actions" (content roles). */
  protected readonly quick = [
    { key: 'addNews', path: '/admin/news/new', query: null },
    { key: 'addDocument', path: '/admin/documents', query: null },
    { key: 'addPartner', path: '/admin/partners', query: null },
  ];

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    // The shell has just fetched the overview for its badges; reuse it on first paint.
    const cached = this.badges.overview();
    if (cached) {
      this.data.set(cached);
      this.loadedAt.set(new Date());
    }
    void this.load();
  }

  protected async load(): Promise<void> {
    this.error.set(false);
    const o = await this.badges.refresh();
    if (o) {
      this.data.set(o);
      this.loadedAt.set(new Date());
    } else {
      this.error.set(true);
    }
  }
}
