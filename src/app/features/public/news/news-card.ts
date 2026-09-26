import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { PostSummary } from '../../../core/api/models';
import { LocaleService } from '../../../core/i18n/locale.service';
import { LocalDatePipe } from '../../../shared/pipes/format';
import { Image } from '../../../shared/ui/image/image';

/**
 * News card (prototype home/news grid): cover or labelled placeholder, category pill, date, title
 * (the link covers the card via a stretched pseudo-element) and excerpt.
 */
@Component({
  selector: 'app-news-card',
  imports: [RouterLink, TranslocoPipe, LocalDatePipe, Image],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card card-flush card-hover relative flex flex-col' },
  template: `
    <app-image
      [asset]="post().coverAsset"
      [placeholder]="post().category?.name ?? ('pages.news.image' | transloco)"
      [aspect]="[16, 9]"
      sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
      imgClass="block w-full h-auto aspect-video object-cover !rounded-none"
    />
    <div class="flex grow flex-col gap-3 p-6">
      <div class="flex flex-wrap items-center gap-3">
        @if (post().category; as c) {
          <span class="pill">{{ c.name }}</span>
        }
        @if (post().publishedOn; as d) {
          <time class="t-caption" [attr.datetime]="d">{{ d | localDate }}</time>
        }
      </div>
      <h3 [class]="headingClass()">
        <a
          class="text-heading no-underline after:absolute after:inset-0 after:content-[''] hover:text-secondary"
          [routerLink]="link()"
          >{{ post().title }}</a
        >
      </h3>
      @if (post().excerpt; as x) {
        <p class="t-small t-muted">{{ x }}</p>
      }
    </div>
  `,
})
export class NewsCard {
  readonly post = input.required<PostSummary>();
  readonly headingClass = input('t-h4');
  private readonly locale = inject(LocaleService);
  protected readonly link = computed(() => this.locale.link(`/news/${this.post().slug}`));
}
