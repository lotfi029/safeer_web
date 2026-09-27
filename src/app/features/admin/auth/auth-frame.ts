import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangSwitch } from '../../../layout/public-shell/lang-switch';
import { ThemeToggle } from '../../../layout/public-shell/theme-toggle';
import { Logo } from '../../../shared/ui/logo/logo';

/** The signed-out staff pages (login, forgot, accept, reset): a centred card on the app background. */
@Component({
  selector: 'app-admin-auth-frame',
  imports: [TranslocoPipe, LangSwitch, ThemeToggle, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col bg-app-bg' },
  template: `
    <header class="flex justify-end gap-2 p-4">
      <app-lang-switch />
      <app-theme-toggle />
    </header>
    <main
      id="main"
      class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 pb-16 sm:px-5"
      tabindex="-1"
    >
      <div class="flex items-center gap-3">
        <app-logo [height]="52" alt="" />
        <div class="flex flex-col">
          <span class="font-bold text-heading">{{ 'admin.shell.dashboard' | transloco }}</span>
          <span class="t-small text-text-muted">{{ 'common.orgName' | transloco }}</span>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <h1 class="t-h2 m-0">{{ heading() }}</h1>
        @if (lead()) {
          <p class="t-muted m-0">{{ lead() }}</p>
        }
      </div>
      <ng-content />
    </main>
  `,
})
export class AdminAuthFrame {
  readonly heading = input.required<string>();
  readonly lead = input<string | null>(null);
}
