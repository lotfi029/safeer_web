import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SiteStore } from '../../core/site/site.store';
import { Logo } from '../../shared/ui/logo/logo';

/** Placeholder home until Phase 3. Missing values render as `[...]` (no invented content). */
@Component({
  selector: 'app-placeholder-home',
  imports: [Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="wrap flex min-h-[60dvh] flex-col items-center justify-center gap-6 py-16 text-center"
    >
      <app-logo [height]="120" priority />
      <h1 class="t-h1">{{ site.site()?.settings?.orgName ?? '[...]' }}</h1>
      <p class="t-lead">{{ site.site()?.settings?.tagline ?? '[...]' }}</p>
    </section>
  `,
})
export class PlaceholderHome {
  protected readonly site = inject(SiteStore);
}
