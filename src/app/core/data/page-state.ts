import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ErrorPanel, type ErrorKind } from '../../features/errors/error-panel';
import type { LoadFailure } from './loaded';

/**
 * Renders the error panel for a failed critical load (status already set by `loadCritical`).
 *
 *   @if (page().failure; as failure) { <app-page-state [failure]="failure" /> } @else { … }
 */
@Component({
  selector: 'app-page-state',
  imports: [ErrorPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-error-panel [kind]="kind()" [retryHref]="retryHref()" />`,
})
export class PageState {
  readonly failure = input.required<LoadFailure>();
  readonly retryHref = input('');
  protected readonly kind = computed<ErrorKind>(() =>
    this.failure() === 'error' ? 'serverError' : (this.failure() as ErrorKind),
  );
}
