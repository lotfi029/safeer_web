import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { form, FormField, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { OtpChannel } from '../../core/api/models';
import { PortalApi } from '../../core/api/portal-api';
import { problemMessageKey, toApiProblem } from '../../core/api/problem';
import { ApplicantSessionStore } from '../../core/auth/applicant-session.store';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { LangSwitch } from '../../layout/public-shell/lang-switch';
import { ThemeToggle } from '../../layout/public-shell/theme-toggle';
import { toArabicDigits } from '../../shared/pipes/format';
import { Button } from '../../shared/ui/button/button';
import { ChoiceGroup } from '../../shared/ui/choice/choice';
import { Control, Field } from '../../shared/ui/field/field';
import { FlowingLines } from '../../shared/ui/flowing-lines/flowing-lines';
import { Icon } from '../../shared/ui/icon/icon';
import { Logo } from '../../shared/ui/logo/logo';
import { OtpInput } from '../../shared/ui/otp-input/otp-input';

export const RESEND_SECONDS = 60;

/** Only same-site portal paths are valid return targets (no open redirects). */
export function safePortalReturn(url: string | undefined, fallback: string): string {
  return url && /^\/(ar|en)\/portal(\/|\?|$)/.test(url) && !url.includes('/portal/login')
    ? url
    : fallback;
}

/**
 * Student portal sign-in (prototype `#/portal-login`, C2 route `/:lang/portal/login`): split band
 * layout. Step 1 `request-otp` with reference/email and a channel choice (B1, mocked); step 2
 * `verify-otp` with the 6-box OTP (paste + `one-time-code`) and a resend countdown. Messages never
 * reveal whether an identifier exists.
 */
@Component({
  selector: 'app-portal-login',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    Button,
    ChoiceGroup,
    Control,
    Field,
    FlowingLines,
    Icon,
    LangSwitch,
    Logo,
    OtpInput,
    ThemeToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid min-h-dvh lg:grid-cols-[46%_1fr]">
      <section
        class="band relative flex flex-col justify-between gap-10 overflow-hidden px-5 py-10 md:px-15 md:py-16"
        aria-labelledby="portal-login-heading"
      >
        <app-flowing-lines class="pointer-events-none absolute inset-0 opacity-60" />
        <a
          class="relative flex items-center gap-3 text-band-text no-underline"
          [routerLink]="locale.link('/')"
        >
          <app-logo [height]="56" />
          <strong class="text-xl">{{ 'common.orgName' | transloco }}</strong>
        </a>
        <div class="relative flex flex-col gap-5">
          <h1 id="portal-login-heading" class="t-h1">{{ 'portal.title' | transloco }}</h1>
          <p class="max-w-105 text-lg leading-[1.9] text-band-soft">
            {{ 'portal.login.lead' | transloco }}
          </p>
          <ul class="m-0 flex list-none flex-col gap-3 p-0">
            @for (perk of perks; track perk) {
              <li class="flex items-center gap-3 text-band-soft">
                <app-icon name="check" />
                {{ 'portal.login.perks.' + perk | transloco }}
              </li>
            }
          </ul>
        </div>
        <!-- Header tools restyled for the dark band (their default muted colours fail contrast here). -->
        <div
          class="relative flex items-center gap-3 [&_a]:!border-band-soft [&_a]:!text-band-text [&_button]:!border-band-soft [&_button]:!bg-transparent [&_button]:!text-band-text"
        >
          <app-lang-switch />
          <app-theme-toggle />
        </div>
      </section>

      <main
        id="main"
        class="mx-auto flex w-full max-w-155 flex-col justify-center gap-6 px-5 py-10 md:px-16 md:py-16"
        tabindex="-1"
      >
        <div class="flex flex-col gap-2">
          <h2 class="t-h2 text-[32px]">{{ 'portal.login.title' | transloco }}</h2>
          <p class="t-muted">{{ 'portal.login.subtitle' | transloco }}</p>
        </div>

        @if (!codeSent()) {
          <form class="flex flex-col gap-5" novalidate (submit)="request($event)">
            <app-field
              [label]="'portal.login.identifier' | transloco"
              [state]="idForm.identifier()"
              [forceErrors]="triedId()"
            >
              <input
                appControl
                type="text"
                dir="ltr"
                autocomplete="username"
                placeholder="SA-2026-00184"
                [formField]="idForm.identifier"
              />
            </app-field>
            <app-choice-group [legend]="'portal.login.channel' | transloco" [columns]="2">
              <label class="choice"
                ><input type="radio" value="email" [formField]="idForm.channel" />
                {{ 'portal.login.channels.email' | transloco }}</label
              >
              <label class="choice"
                ><input type="radio" value="sms" [formField]="idForm.channel" />
                {{ 'portal.login.channels.sms' | transloco }}</label
              >
            </app-choice-group>
            @if (errorKey(); as key) {
              <p class="note note-warn" role="alert">{{ key | transloco }}</p>
            }
            <button appButton type="submit" class="min-h-14" [busy]="busy()" [disabled]="busy()">
              {{ (busy() ? 'portal.login.sending' : 'portal.login.sendCode') | transloco }}
            </button>
          </form>
        } @else {
          <form class="flex flex-col gap-5" novalidate (submit)="verify($event)">
            <p class="note" role="status">{{ 'portal.login.sent' | transloco }}</p>
            <div class="flex flex-col gap-2">
              <p id="portal-otp-label" class="field-label">
                {{ 'portal.login.codeLabel' | transloco }}
              </p>
              <app-otp-input
                class="self-start"
                labelledBy="portal-otp-label"
                describedBy="portal-otp-hint"
                [formField]="otpForm.code"
                (completed)="verify()"
              />
              <p id="portal-otp-hint" class="field-hint">
                {{ 'portal.login.codeHint' | transloco }}
              </p>
            </div>
            @if (errorKey(); as key) {
              <p class="note note-warn" role="alert">{{ key | transloco }}</p>
            }
            <button appButton type="submit" class="min-h-14" [busy]="busy()" [disabled]="busy()">
              {{ (busy() ? 'portal.login.verifying' : 'portal.login.submit') | transloco }}
            </button>
            <button
              appButton
              variant="soft"
              type="button"
              [disabled]="countdown() > 0 || busy()"
              (click)="resend()"
            >
              {{
                countdown() > 0
                  ? ('portal.login.resendIn' | transloco: { seconds: countdownText() })
                  : ('portal.login.resend' | transloco)
              }}
            </button>
            <button
              appButton
              variant="link"
              type="button"
              class="self-start"
              (click)="changeIdentifier()"
            >
              {{ 'portal.login.change' | transloco }}
            </button>
          </form>
        }

        <hr class="border-border" />
        <div
          class="card flex flex-col items-start gap-4 !bg-surface sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex flex-col gap-1">
            <strong class="text-lg text-primary">{{
              'portal.login.notApplied' | transloco
            }}</strong>
            <span class="t-caption">{{ 'portal.login.notAppliedBody' | transloco }}</span>
          </div>
          <a appButton variant="ghost" size="sm" [routerLink]="locale.link('/apply')">{{
            'portal.login.apply' | transloco
          }}</a>
        </div>
        <a class="font-semibold" [routerLink]="locale.link('/contact')">{{
          'portal.login.trouble' | transloco
        }}</a>
      </main>
    </div>
  `,
})
export class PortalLogin {
  readonly returnUrl = input<string | undefined>();

  protected readonly locale = inject(LocaleService);
  private readonly api = inject(PortalApi);
  private readonly store = inject(ApplicantSessionStore);
  private readonly router = inject(Router);

  protected readonly perks = ['status', 'documents', 'notifications'] as const;

  private readonly idValue = signal<{ identifier: string; channel: OtpChannel }>({
    identifier: '',
    channel: 'email',
  });
  protected readonly idForm = form(this.idValue, (p) => {
    required(p.identifier);
    maxLength(p.identifier, 191);
  });
  private readonly otpValue = signal({ code: '' });
  protected readonly otpForm = form(this.otpValue, (p) => {
    required(p.code);
    pattern(p.code, /^\d{6}$/);
  });

  protected readonly codeSent = signal(false);
  protected readonly busy = signal(false);
  protected readonly triedId = signal(false);
  protected readonly triedCode = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly countdown = signal(0);
  protected readonly countdownText = computed(() =>
    this.locale.lang() === 'ar'
      ? toArabicDigits(String(this.countdown()))
      : String(this.countdown()),
  );
  private ticker: ReturnType<typeof setInterval> | undefined;
  private verifying = false;

  constructor() {
    inject(SeoService).noindex(
      inject(TranslocoService).translate('portal.title'),
      this.locale.lang(),
    );
    inject(DestroyRef).onDestroy(() => clearInterval(this.ticker));
  }

  protected async request(event?: Event): Promise<void> {
    event?.preventDefault();
    this.triedId.set(true);
    this.errorKey.set(null);
    await submit(this.idForm, async () => {
      this.busy.set(true);
      try {
        const { identifier, channel } = this.idValue();
        await firstValueFrom(this.api.requestOtp(identifier.trim(), channel));
        this.codeSent.set(true);
        this.startCountdown();
        setTimeout(() => document.querySelector<HTMLInputElement>('app-otp-input input')?.focus());
      } catch (error) {
        this.errorKey.set(problemMessageKey(toApiProblem(error)));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }

  protected async resend(): Promise<void> {
    this.otpValue.set({ code: '' });
    this.triedCode.set(false);
    await this.request();
  }

  protected changeIdentifier(): void {
    this.codeSent.set(false);
    this.otpValue.set({ code: '' });
    this.errorKey.set(null);
    this.triedCode.set(false);
  }

  protected async verify(event?: Event): Promise<void> {
    event?.preventDefault();
    // Synchronous guard: the OTP `completed` output and the form submit can both fire before the
    // async submit action starts; a second call would burn the one-time code.
    if (this.verifying) {
      return;
    }
    this.verifying = true;
    this.triedCode.set(true);
    this.errorKey.set(null);
    await submit(this.otpForm, async () => {
      this.busy.set(true);
      try {
        const res = await firstValueFrom(
          this.api.verifyOtp(this.idValue().identifier.trim(), this.otpValue().code),
        );
        this.store.startSession(res.csrfToken);
        await this.store.refresh();
        await this.router.navigateByUrl(
          safePortalReturn(this.returnUrl(), this.locale.link('/portal')),
        );
      } catch (error) {
        const problem = toApiProblem(error);
        // A1: every failure (wrong, expired, or locked after too many wrong codes) is one 401.
        this.errorKey.set(
          problem.status === 401 ? 'portal.login.invalidCode' : problemMessageKey(problem),
        );
        this.otpValue.set({ code: '' });
      } finally {
        this.busy.set(false);
      }
      return undefined;
    }).finally(() => (this.verifying = false));
  }

  private startCountdown(): void {
    clearInterval(this.ticker);
    this.countdown.set(RESEND_SECONDS);
    this.ticker = setInterval(() => {
      this.countdown.update((n) => Math.max(0, n - 1));
      if (this.countdown() === 0) {
        clearInterval(this.ticker);
      }
    }, 1000);
  }
}
