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
import {
  email,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { ContactSubject, Page } from '../../../core/api/models';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { PublicApi } from '../../../core/api/public-api';
import type { Loaded } from '../../../core/data/loaded';
import { PageState } from '../../../core/data/page-state';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SiteStore } from '../../../core/site/site.store';
import { problemToTreeErrors } from '../../../shared/forms/server-errors';
import { mapSearchUrl, safeMapEmbedUrl } from '../../../shared/map/map-embed';
import { Button } from '../../../shared/ui/button/button';
import { Control, Field } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageHead } from '../../../shared/ui/page-head/page-head';
import { Reveal } from '../../../shared/ui/reveal/reveal';
import { pageSeo } from '../page-meta';

export const CONTACT_SUBJECTS: readonly ContactSubject[] = [
  'scholarship',
  'partnership',
  'feedback',
  'other',
];

/** Names: letters (any script), marks, spaces, apostrophes, dots and hyphens (backend C16). */
export const NAME_PATTERN = /^[\p{L}\p{M}\s'.-]+$/u;

export { contactResolver } from './contact.resolver';

interface ContactModel {
  name: string;
  phone: string;
  email: string;
  subject: ContactSubject;
  body: string;
  /** Honeypot (must stay empty; the API silently drops submissions that fill it). */
  website: string;
}

/**
 * Contact (prototype `#/contact`): contact cards from GET /site, Signal Forms message form →
 * POST /contact with honeypot + `formRenderedAt` (set in the browser after hydration, F12),
 * problem-details field errors, and a map facade (A12): when `settings.mapEmbedUrl` is an allowed
 * Google Maps / OpenStreetMap embed, the iframe loads only after the visitor asks for it, so nothing
 * third-party is fetched on page load. "Open in maps" uses the pin (`mapLat`/`mapLng`) or the address.
 */
@Component({
  selector: 'app-contact-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    PageState,
    Button,
    Control,
    Field,
    Icon,
    PageHead,
    Reveal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().failure; as failure) {
      <app-page-state [failure]="failure" />
    } @else if (data().data; as page) {
      <app-page-head
        [title]="page.title"
        [lead]="page.metaDescription"
        [breadcrumb]="breadcrumb()"
      />

      <section class="py-12 md:py-16" aria-labelledby="contact-cards-title">
        <h2 id="contact-cards-title" class="sr-only">{{ 'shell.footer.contact' | transloco }}</h2>
        <div class="wrap flex flex-col gap-8">
          <ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3">
            <li appReveal [revealIndex]="0" class="card card-hover flex flex-col gap-3">
              <span class="icon-tile"><app-icon name="phone" [size]="24" /></span>
              <h3 class="text-[19px] font-semibold">{{ 'pages.contact.phone' | transloco }}</h3>
              @if (contact()?.phone; as phone) {
                <a class="text-xl font-semibold" [href]="'tel:' + tel(phone)"
                  ><bdi class="ltr">{{ phone }}</bdi></a
                >
              } @else {
                <p>{{ 'common.placeholder' | transloco }}</p>
              }
              <p class="t-caption">{{ 'pages.contact.hours' | transloco }}</p>
            </li>
            <li appReveal [revealIndex]="1" class="card card-hover flex flex-col gap-3">
              <span class="icon-tile"><app-icon name="mail" [size]="24" /></span>
              <h3 class="text-[19px] font-semibold">{{ 'pages.contact.email' | transloco }}</h3>
              @if (contact()?.email; as mail) {
                <a class="text-xl font-semibold break-all" [href]="'mailto:' + mail"
                  ><bdi class="ltr">{{ mail }}</bdi></a
                >
              } @else {
                <p>{{ 'common.placeholder' | transloco }}</p>
              }
              <p class="t-caption">{{ 'pages.contact.replyTime' | transloco }}</p>
            </li>
            <li appReveal [revealIndex]="2" class="card card-hover flex flex-col gap-3">
              <span class="icon-tile"><app-icon name="map-pin" [size]="24" /></span>
              <h3 class="text-[19px] font-semibold">{{ 'pages.contact.address' | transloco }}</h3>
              <p class="leading-[1.8]">
                {{ contact()?.address ?? ('common.placeholder' | transloco) }}
              </p>
              @if (mapHref(); as href) {
                <a
                  class="t-small inline-flex min-h-11 items-center gap-1"
                  [href]="href"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ 'pages.contact.directions' | transloco }}
                  <app-icon name="external-link" [size]="16" />
                </a>
              }
            </li>
          </ul>

          <div
            class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]"
          >
            <div class="card !bg-surface md:!px-12 md:!py-11">
              @if (sent()) {
                <div class="flex flex-col items-start gap-5" role="status">
                  <p class="note note-ok w-full">
                    <app-icon name="circle-check" /> {{ 'pages.contact.sent' | transloco }}
                  </p>
                  <button appButton variant="line" type="button" (click)="reset()">
                    {{ 'pages.contact.sendAnother' | transloco }}
                  </button>
                </div>
              } @else {
                <form
                  class="flex flex-col gap-6"
                  novalidate
                  aria-labelledby="contact-form-title"
                  (submit)="onSubmit($event)"
                >
                  <div class="flex flex-col gap-2">
                    <h2 id="contact-form-title" class="text-[30px] font-semibold">
                      {{ 'pages.contact.formTitle' | transloco }}
                    </h2>
                    <p class="t-muted">{{ 'pages.contact.formLead' | transloco }}</p>
                  </div>
                  <div class="grid gap-5 md:grid-cols-2">
                    <app-field
                      [label]="'pages.contact.name' | transloco"
                      [state]="model.name()"
                      [forceErrors]="tried()"
                    >
                      <input appControl type="text" autocomplete="name" [formField]="model.name" />
                    </app-field>
                    <app-field
                      [label]="'pages.contact.phone' | transloco"
                      [state]="model.phone()"
                      [optional]="true"
                      [forceErrors]="tried()"
                    >
                      <input
                        appControl
                        type="tel"
                        inputmode="tel"
                        autocomplete="tel"
                        dir="ltr"
                        [formField]="model.phone"
                      />
                    </app-field>
                    <app-field
                      [label]="'pages.contact.email' | transloco"
                      [state]="model.email()"
                      [forceErrors]="tried()"
                    >
                      <input
                        appControl
                        type="email"
                        inputmode="email"
                        autocomplete="email"
                        dir="ltr"
                        [formField]="model.email"
                      />
                    </app-field>
                    <app-field
                      [label]="'pages.contact.subject' | transloco"
                      [state]="model.subject()"
                    >
                      <select appControl [formField]="model.subject">
                        @for (s of subjects; track s) {
                          <option [value]="s">
                            {{ 'pages.contact.subjects.' + s | transloco }}
                          </option>
                        }
                      </select>
                    </app-field>
                  </div>
                  <app-field
                    [label]="'pages.contact.message' | transloco"
                    [state]="model.body()"
                    [forceErrors]="tried()"
                  >
                    <textarea appControl rows="6" [formField]="model.body"></textarea>
                  </app-field>
                  <!-- Honeypot: invisible to people and assistive tech, bots fill it. -->
                  <div class="sr-only" aria-hidden="true">
                    <label for="contact-website">{{ 'pages.contact.honeypot' | transloco }}</label>
                    <input
                      id="contact-website"
                      type="text"
                      tabindex="-1"
                      autocomplete="off"
                      [formField]="model.website"
                    />
                  </div>
                  @if (errorKey(); as key) {
                    <p class="note note-warn" role="alert">{{ key | transloco }}</p>
                  }
                  <div
                    class="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p class="t-caption max-w-105">{{ 'pages.contact.privacy' | transloco }}</p>
                    <button appButton type="submit" [busy]="busy()" [disabled]="busy()">
                      {{ (busy() ? 'pages.contact.sending' : 'pages.contact.send') | transloco }}
                    </button>
                  </div>
                </form>
              }
            </div>

            <aside class="flex flex-col gap-6">
              <div class="img-placeholder dim min-h-80" data-testid="contact-map">
                @if (mapFrame(); as src) {
                  <iframe
                    class="min-h-80 w-full rounded-(--radius-card) border-0"
                    [src]="src"
                    [title]="'pages.contact.map' | transloco"
                    loading="lazy"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen
                  ></iframe>
                } @else {
                  <div
                    class="flex flex-col items-center gap-3"
                    role="img"
                    [attr.aria-label]="
                      'common.imagePlaceholder'
                        | transloco: { label: ('pages.contact.map' | transloco) }
                    "
                  >
                    <app-icon name="map-pin" [size]="36" />
                    <span aria-hidden="true">{{
                      'common.imagePlaceholder'
                        | transloco: { label: ('pages.contact.map' | transloco) }
                    }}</span>
                  </div>
                  @if (mapEmbed()) {
                    <button appButton size="sm" type="button" (click)="showMap.set(true)">
                      {{ 'pages.contact.showMap' | transloco }}
                    </button>
                  }
                }
                @if (mapHref(); as href) {
                  <a
                    appButton
                    variant="line"
                    size="sm"
                    [href]="href"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ 'pages.contact.openMap' | transloco }}</a
                  >
                }
              </div>
              <div class="card band border-0">
                <h2 class="t-h4">{{ 'pages.contact.registerTitle' | transloco }}</h2>
                <p class="mt-3 mb-5 text-band-soft">
                  {{ 'pages.contact.registerBody' | transloco }}
                </p>
                <a appButton variant="onband" [block]="true" [routerLink]="locale.link('/apply')">{{
                  'pages.contact.registerCta' | transloco
                }}</a>
              </div>
            </aside>
          </div>
        </div>
      </section>
    }
  `,
})
export class ContactPage {
  readonly data = input.required<Loaded<Page>>();
  /** `?subject=partnership|feedback|…` preselects the subject (partners/testimonials CTAs). */
  readonly subject = input<string | undefined>();

  protected readonly locale = inject(LocaleService);
  private readonly site = inject(SiteStore);
  private readonly api = inject(PublicApi);
  private readonly t = inject(TranslocoService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly seo = pageSeo();

  protected readonly subjects = CONTACT_SUBJECTS;
  protected readonly contact = computed(() => this.site.site()?.contact ?? null);
  private readonly settings = computed(() => this.site.site()?.settings ?? null);
  protected readonly mapEmbed = computed(() => safeMapEmbedUrl(this.settings()?.mapEmbedUrl));
  protected readonly showMap = signal(false);
  /** Trusted only after `safeMapEmbedUrl` pinned it to the two hosts the CSP `frame-src` allows. */
  protected readonly mapFrame = computed(() => {
    const url = this.mapEmbed();
    return url && this.showMap() ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  protected readonly mapHref = computed(() =>
    mapSearchUrl(this.settings()?.mapLat, this.settings()?.mapLng, this.contact()?.address),
  );
  protected readonly breadcrumb = computed(() => [
    { label: this.t.translate('pages.breadcrumbHome'), link: this.locale.link('/') },
    { label: this.data().data?.title ?? '' },
  ]);

  private readonly value = signal<ContactModel>({
    name: '',
    phone: '',
    email: '',
    subject: 'scholarship',
    body: '',
    website: '',
  });
  protected readonly model = form(this.value, (p) => {
    required(p.name);
    maxLength(p.name, 191);
    pattern(p.name, NAME_PATTERN, { message: this.t.translate('pages.contact.nameInvalid') });
    maxLength(p.phone, 40);
    required(p.email);
    email(p.email);
    maxLength(p.email, 191);
    required(p.body);
    maxLength(p.body, 5000);
  });

  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  /** Set once the form is interactive in the browser (F12): the API drops submits < 3s later. */
  private formRenderedAt: number | null = null;

  constructor() {
    effect(() => this.seo({ page: this.data().data, path: '/contact' }));
    effect(() => {
      const s = this.subject();
      if (s && (CONTACT_SUBJECTS as readonly string[]).includes(s)) {
        this.value.update((v) => ({ ...v, subject: s as ContactSubject }));
      }
    });
    afterNextRender(() => (this.formRenderedAt = Date.now()));
  }

  protected tel(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  protected reset(): void {
    this.value.set({
      name: '',
      phone: '',
      email: '',
      subject: this.value().subject,
      body: '',
      website: '',
    });
    this.tried.set(false);
    this.sent.set(false);
    this.formRenderedAt = Date.now();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    await submit(this.model, async () => {
      this.busy.set(true);
      try {
        const v = this.value();
        await firstValueFrom(
          this.api.contact({
            name: v.name.trim(),
            email: v.email.trim(),
            phone: v.phone.trim() || null,
            subject: v.subject,
            body: v.body.trim(),
            website: v.website,
            formRenderedAt: this.formRenderedAt ?? Date.now(),
          }),
        );
        this.sent.set(true);
        return undefined;
      } catch (error) {
        const problem = toApiProblem(error);
        this.errorKey.set(problemMessageKey(problem));
        return problemToTreeErrors(this.model as never, problem);
      } finally {
        this.busy.set(false);
      }
    });
  }
}
