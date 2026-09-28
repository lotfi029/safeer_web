import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Cookies } from '../../core/platform/cookies';
import { motionAllowed } from '../../shared/ui/reveal/motion';

const INTRO_COOKIE = 'intro';

/**
 * First-visit logo intro (spec §2: 0→1.2s mark → rule → name). Browser-only and cookie-gated: it
 * is never in the SSR HTML, never blocks content for crawlers/no-JS users, and is skipped under
 * prefers-reduced-motion. Decorative (aria-hidden); the page underneath is already interactive.
 */
@Component({
  selector: 'app-logo-intro',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .intro {
      animation: intro-out 400ms ease 1.2s forwards;
    }
    .mark {
      opacity: 0;
      transform: scale(0.88);
      animation: intro-mark 700ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
    }
    .rule {
      inline-size: 0;
      animation: intro-rule 600ms ease 350ms forwards;
    }
    .word {
      opacity: 0;
      animation: intro-fade 500ms ease 550ms forwards;
    }
    @keyframes intro-mark {
      to {
        opacity: 1;
        transform: none;
      }
    }
    @keyframes intro-rule {
      to {
        inline-size: 120px;
      }
    }
    @keyframes intro-fade {
      to {
        opacity: 1;
      }
    }
    @keyframes intro-out {
      to {
        opacity: 0;
        visibility: hidden;
      }
    }
  `,
  template: `
    @if (show()) {
      <div
        class="intro pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-bg"
        aria-hidden="true"
      >
        <div class="flex flex-col items-center gap-4">
          <img
            class="mark h-33 w-auto"
            src="/brand/safeer-mark.svg"
            width="642"
            height="974"
            alt=""
          />
          <span class="rule block h-0.5 rounded-sm bg-secondary"></span>
          <span class="word text-[22px] font-bold text-heading">{{
            'common.orgName' | transloco
          }}</span>
        </div>
      </div>
    }
  `,
})
export class LogoIntro {
  protected readonly show = signal(false);

  constructor() {
    const cookies = inject(Cookies);
    afterNextRender(() => {
      if (cookies.get(INTRO_COOKIE) || !motionAllowed(window)) {
        return;
      }
      cookies.set(INTRO_COOKIE, '1');
      this.show.set(true);
      setTimeout(() => this.show.set(false), 1700);
    });
  }
}
