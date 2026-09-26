import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  SecurityContext,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Renders HTML the API already sanitized (news body; page-section/about-item bodies after backend
 * C26) through Angular's sanitizer as a second line of defence. The ONLY sanctioned use of
 * `[innerHTML]` in the app (hard rule 6).
 */
@Component({
  selector: 'app-rich-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'rich-text block', '[innerHTML]': 'safe()' },
  template: '',
})
export class RichText {
  readonly html = input<string | null | undefined>(null);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly safe = computed(
    () => this.sanitizer.sanitize(SecurityContext.HTML, this.html() ?? '') ?? '',
  );
}
