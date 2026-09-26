import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { PublicApi } from '../../../core/api/public-api';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { Button } from '../../../shared/ui/button/button';
import { Icon } from '../../../shared/ui/icon/icon';

type TokenState = 'idle' | 'working' | 'done' | 'invalid' | 'missing';

/**
 * Newsletter double opt-in confirm (`/:lang/newsletter/confirm?token=`) and unsubscribe
 * (`/:lang/newsletter/unsubscribe?token=`), C27. Nothing is posted during SSR. Confirm runs once the
 * page is interactive in the browser; unsubscribe waits for an explicit click, so mail scanners that
 * pre-fetch links can't unsubscribe anyone. Both pages are `noindex`.
 */
@Component({
  selector: 'app-newsletter-token-page',
  imports: [RouterLink, TranslocoPipe, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="wrap flex justify-center py-16 md:py-24"
      aria-labelledby="newsletter-token-title"
    >
      <div class="card flex w-full max-w-140 flex-col items-start gap-5">
        <span class="icon-tile"><app-icon name="mail" [size]="24" /></span>
        <h1 id="newsletter-token-title" class="t-h3">{{ key('title') | transloco }}</h1>
        @switch (state()) {
          @case ('done') {
            <p class="note note-ok w-full" role="status">
              <app-icon name="circle-check" /> {{ key('done') | transloco }}
            </p>
          }
          @case ('invalid') {
            <p class="note note-warn w-full" role="alert">{{ key('invalid') | transloco }}</p>
          }
          @case ('missing') {
            <p class="note note-warn w-full" role="alert">{{ key('missing') | transloco }}</p>
          }
          @case ('working') {
            <p role="status">{{ key('working') | transloco }}</p>
          }
          @default {
            @if (mode() === 'unsubscribe') {
              <p class="t-muted">{{ 'pages.news.unsubscribe.lead' | transloco }}</p>
              <button appButton variant="danger" type="button" (click)="run()">
                {{ 'pages.news.unsubscribe.button' | transloco }}
              </button>
            } @else {
              <p role="status">{{ key('working') | transloco }}</p>
            }
          }
        }
        <a appButton variant="link" [routerLink]="locale.link('/news')">{{
          'pages.news.backToNews' | transloco
        }}</a>
      </div>
    </section>
  `,
})
export class NewsletterTokenPage {
  /** Route data. */
  readonly mode = input<'confirm' | 'unsubscribe'>('confirm');
  /** `?token=` query param. */
  readonly token = input<string | undefined>();

  protected readonly locale = inject(LocaleService);
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly t = inject(TranslocoService);

  protected readonly state = signal<TokenState>('idle');
  private readonly cleanToken = computed(() => this.token()?.trim() || null);

  constructor() {
    effect(() => {
      this.seo.noindex(this.t.translate(this.key('title')), this.locale.lang());
    });
    afterNextRender(() => {
      if (!this.cleanToken()) {
        this.state.set('missing');
      } else if (this.mode() === 'confirm') {
        void this.run();
      }
    });
  }

  protected key(name: string): string {
    return `pages.news.${this.mode()}.${name}`;
  }

  protected async run(): Promise<void> {
    const token = this.cleanToken();
    if (!token || this.state() === 'working') {
      return;
    }
    this.state.set('working');
    try {
      await firstValueFrom(
        this.mode() === 'confirm'
          ? this.api.newsletterConfirm(token)
          : this.api.newsletterUnsubscribe(token),
      );
      this.state.set('done');
    } catch {
      this.state.set('invalid');
    }
  }
}
