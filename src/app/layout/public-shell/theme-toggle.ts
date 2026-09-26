import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../core/theme/theme.service';
import { Icon } from '../../shared/ui/icon/icon';

/** Light/dark toggle (icon-only button with an aria-label naming the target mode). */
@Component({
  selector: 'app-theme-toggle',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="icon-btn"
      [attr.aria-label]="
        (theme.effective() === 'dark' ? 'common.theme.toLight' : 'common.theme.toDark') | transloco
      "
      (click)="theme.toggle()"
    >
      <app-icon [name]="theme.effective() === 'dark' ? 'sun' : 'moon'" />
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
}
