import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

export interface BreadcrumbItem {
  label: string;
  /** Router link (string or commands). Omitted for the current page. */
  link?: string | readonly unknown[];
}

/**
 * Breadcrumb trail joined by " · " (prototype `pageHead`). The last item is the current page
 * (`aria-current="page"`, not a link). Works on light backgrounds (`tone="light"`) and the band.
 */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <nav [attr.aria-label]="'ui.breadcrumb' | transloco">
      <ol
        class="t-small m-0 flex list-none flex-wrap items-center gap-x-2 p-0"
        [class]="tone() === 'band' ? 'text-(--band-dim)' : 'text-text-muted'"
      >
        @for (item of items(); track $index; let last = $last) {
          <li class="inline-flex items-center gap-2">
            @if (last) {
              <span aria-current="page">{{ item.label }}</span>
            } @else if (item.link) {
              <a
                [routerLink]="$any(item.link)"
                class="underline-offset-4 hover:underline"
                [class]="tone() === 'band' ? 'text-(--band-dim) hover:text-band-text' : ''"
                >{{ item.label }}</a
              >
            } @else {
              <span>{{ item.label }}</span>
            }
            @if (!last) {
              <span aria-hidden="true">·</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Breadcrumb {
  readonly items = input.required<readonly BreadcrumbItem[]>();
  readonly tone = input<'light' | 'band'>('light');
}
