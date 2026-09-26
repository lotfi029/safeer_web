import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { API_PREFIX } from '../../core/config/api-base-url';

/** Subset of `GET /site` used by the Phase 0 placeholder (full model lands in Phase 1). */
interface SiteSummary {
  settings: { orgName?: string | null; tagline?: string | null } | null;
}

/**
 * Phase 0 placeholder for `/:lang`. Proves SSR + the API proxy end to end; replaced by the real
 * home page in Phase 3. Missing values render as `[...]` (no invented content).
 */
@Component({
  selector: 'app-placeholder-home',
  imports: [NgOptimizedImage, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      id="main"
      class="mx-auto flex min-h-dvh max-w-[1280px] flex-col items-center justify-center gap-6 px-5 py-16 text-center md:px-15"
    >
      <!-- TODO(logo): replace with the official SVG logo (spec §6.1). Never ship a traced SVG. -->
      <img
        ngSrc="/brand/safeer-logo.png"
        width="150"
        height="228"
        priority
        alt=""
        class="h-auto w-24"
      />
      <h1 class="text-4xl leading-tight font-bold text-primary">{{ orgName() }}</h1>
      <p class="text-lg text-text-muted">{{ tagline() }}</p>
      <nav aria-label="Language" class="flex gap-4">
        <a
          [routerLink]="['/', otherLang()]"
          [attr.hreflang]="otherLang()"
          [attr.lang]="otherLang()"
          class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-border px-5 text-secondary underline-offset-4 hover:underline"
        >
          {{ otherLang() === 'en' ? 'English' : 'العربية' }}
        </a>
      </nav>
    </main>
  `,
})
export class PlaceholderHome {
  readonly lang = input.required<string>();
  protected readonly otherLang = computed(() => (this.lang() === 'en' ? 'ar' : 'en'));

  private readonly site = httpResource<SiteSummary>(() => `${API_PREFIX}/site?lang=${this.lang()}`);

  protected readonly orgName = computed(() =>
    this.site.hasValue() ? (this.site.value().settings?.orgName ?? '[...]') : '[...]',
  );
  protected readonly tagline = computed(() =>
    this.site.hasValue() ? (this.site.value().settings?.tagline ?? '[...]') : '[...]',
  );
}
