import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { Icon } from '../../../shared/ui/icon/icon';
import { Image } from '../../../shared/ui/image/image';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { SectionHeading } from '../../../shared/ui/section-heading/section-heading';
import { pageSeo } from '../page-meta';
import type { BoardPageData } from './board.resolver';

export { boardResolver, type BoardPageData } from './board.resolver';

/**
 * Board of directors (prototype `#/board`): page head, board grid with the chair (`isLead`) as a wide
 * band card, and the executive block. Photo or a person placeholder; bio (B12) when present.
 */
@Component({
  selector: 'app-board-page',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    PageState,
    PageHead,
    SectionHeading,
    Icon,
    Image,
    Reveal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as d) {
      <app-page-head
        [title]="d.page.title"
        [lead]="d.page.metaDescription"
        [breadcrumb]="breadcrumb()"
      />

      <section class="section" aria-labelledby="board-members">
        <div class="wrap flex flex-col gap-10">
          <app-section-heading
            headingId="board-members"
            [eyebrow]="'pages.board.membersEyebrow' | transloco"
            [heading]="'pages.board.membersHeading' | transloco"
          />
          <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
            @for (m of board(); track m.id; let i = $index) {
              <li
                appReveal
                [revealIndex]="i"
                class="card flex items-start gap-5"
                [class.band]="m.isLead"
                [class.md:col-span-2]="m.isLead"
                [class.border-transparent]="m.isLead"
              >
                <ng-container *ngTemplateOutlet="avatar; context: { $implicit: m }" />
                <div class="flex min-w-0 flex-col gap-2">
                  <span class="pill self-start" [class.pill-solid]="m.isLead">{{ m.role }}</span>
                  <h3 class="t-h4">{{ m.name }}</h3>
                  @if (m.bio) {
                    <p class="t-small" [class.t-muted]="!m.isLead">{{ m.bio }}</p>
                  }
                </div>
              </li>
            }
          </ul>
        </div>
      </section>

      @if (executive().length) {
        <section class="section bg-surface" aria-labelledby="board-exec">
          <div class="wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_2fr] lg:items-start">
            <app-section-heading
              headingId="board-exec"
              [eyebrow]="'pages.board.executiveEyebrow' | transloco"
              [heading]="'pages.board.executiveHeading' | transloco"
              [lead]="'pages.board.executiveLead' | transloco"
            />
            <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 xl:grid-cols-3">
              @for (m of executive(); track m.id; let i = $index) {
                <li appReveal [revealIndex]="i" class="card flex flex-col gap-3">
                  <ng-container *ngTemplateOutlet="avatar; context: { $implicit: m }" />
                  <span class="t-caption font-semibold !text-secondary">{{ m.role }}</span>
                  <h3 class="t-h4">{{ m.name }}</h3>
                  @if (m.bio) {
                    <p class="t-small t-muted">{{ m.bio }}</p>
                  }
                </li>
              }
            </ul>
          </div>
        </section>
      }

      <ng-template #avatar let-m>
        @if (m.photoAsset) {
          <app-image
            class="size-21 shrink-0 overflow-hidden rounded-2xl"
            imgClass="size-21 object-cover"
            [asset]="m.photoAsset"
            sizes="84px"
            [alt]="'pages.board.photoOf' | transloco: { name: m.name }"
          />
        } @else {
          <span
            class="icon-tile size-21 rounded-2xl"
            [class.!bg-band-card]="m.isLead"
            [class.!text-band-soft]="m.isLead"
          >
            <app-icon name="user" [size]="28" />
          </span>
        }
      </ng-template>
    }
  `,
})
export class BoardPage {
  readonly data = input.required<Loaded<BoardPageData>>();
  private readonly locale = inject(LocaleService);
  private readonly t = inject(TranslocoService);

  // W1: the API groups members itself ({ board, executive }, each in sortOrder).
  protected readonly board = computed(() => this.data().data?.members.board ?? []);
  protected readonly executive = computed(() => this.data().data?.members.executive ?? []);
  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.t.translate('shell.footer.about'), link: this.locale.link('/about') },
    { label: this.data().data?.page.title ?? '' },
  ]);

  private readonly seo = pageSeo();

  constructor() {
    effect(() => this.seo({ page: this.data().data?.page, path: '/board' }));
  }
}
