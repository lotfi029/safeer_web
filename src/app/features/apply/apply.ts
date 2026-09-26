import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  email,
  form,
  FormField,
  maxLength,
  minLength,
  pattern,
  required,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { ApplicantDocument, Country, DocType } from '../../core/api/models';
import { PortalApi } from '../../core/api/portal-api';
import { type ApiProblem, problemMessageKey, toApiProblem } from '../../core/api/problem';
import { ApplicantSessionStore } from '../../core/auth/applicant-session.store';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { toArabicDigits } from '../../shared/pipes/format';
import type { FieldErrorLike } from '../../shared/ui/field/field';
import { Button } from '../../shared/ui/button/button';
import { ChoiceGroup } from '../../shared/ui/choice/choice';
import { Control, Field } from '../../shared/ui/field/field';
import { Icon } from '../../shared/ui/icon/icon';
import { Progress } from '../../shared/ui/progress/progress';
import { Stepper } from '../../shared/ui/stepper/stepper';
import { NAME_PATTERN } from '../public/contact/contact';
import { ApplyDocuments } from './apply-documents';
import { clearDraft, loadDraft, saveDraft, type StoredDraft } from './apply-draft';
import {
  changedFields,
  emptyApplyValue,
  fromMe,
  STEP1_FIELDS,
  STEP2_FIELDS,
  toPatch,
  toStep1,
  type ApplyField,
  type ApplyFormValue,
} from './apply-payload';

export const AUTOSAVE_DEBOUNCE_MS = 1500;
const RETRY_BACKOFF_MS = [2000, 4000, 8000, 16000, 30000, 60000];
const PHONE_PATTERN = /^\+?[\d\s()-]{5,40}$/;

export { applyResolver } from './apply.resolver';

type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';
type Phase = 'form' | 'exists' | 'locked' | 'success';

/**
 * Scholarship application (prototype `#/apply`), three steps with Signal Forms:
 *  1. personal → `POST /applications` creates the draft and the applicant session (cookie + CSRF);
 *  2. study, 3. documents + consent → autosaved with `PATCH /portal/application` (1.5s debounce,
 *     changed + valid fields only, F4 payload rules), falling back to a sessionStorage copy when the
 *     API can't be reached (F5) with retry/backoff;
 *  submit → `POST /portal/application/submit` (`DOCUMENTS_INCOMPLETE` highlights the missing types).
 * Resuming (reload, or coming back from the portal) reads `GET /portal/me`.
 */
@Component({
  selector: 'app-apply-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    Button,
    ChoiceGroup,
    Control,
    Field,
    Icon,
    Progress,
    Stepper,
    ApplyDocuments,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="border-b border-border bg-surface py-10 md:py-14">
      <div class="wrap flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <h1 class="t-h1">{{ 'pages.apply.title' | transloco }}</h1>
          <p class="t-lead max-w-155">{{ 'pages.apply.lead' | transloco }}</p>
        </div>
        @if (phase() === 'form') {
          <app-stepper [steps]="steps()" [current]="step()" [completed]="completed()" />
        }
      </div>
    </section>

    <section class="py-10 md:py-14">
      <div
        class="wrap grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div class="flex min-w-0 flex-col gap-6">
          @switch (phase()) {
            @case ('success') {
              <div
                class="card flex flex-col items-start gap-5"
                role="status"
                tabindex="-1"
                #focusTarget
              >
                <span class="icon-tile"><app-icon name="circle-check" [size]="26" /></span>
                <h2 class="t-h3">{{ 'pages.apply.successTitle' | transloco }}</h2>
                <p>{{ 'pages.apply.successBody' | transloco }}</p>
                <p class="flex flex-wrap items-center gap-3">
                  <span class="t-caption">{{ 'pages.apply.referenceLabel' | transloco }}</span>
                  <bdi dir="ltr" class="text-xl font-bold text-heading" data-testid="reference">{{
                    reference()
                  }}</bdi>
                </p>
                <a appButton [routerLink]="locale.link('/portal')">{{
                  'pages.apply.goPortal' | transloco
                }}</a>
              </div>
            }
            @case ('exists') {
              <div class="card flex flex-col items-start gap-5" role="alert">
                <p class="note note-warn w-full">{{ 'pages.apply.exists' | transloco }}</p>
                <a appButton [routerLink]="locale.link('/portal/login')">{{
                  'pages.apply.goPortal' | transloco
                }}</a>
              </div>
            }
            @case ('locked') {
              <div class="card flex flex-col items-start gap-5" role="status">
                <p class="note w-full">{{ 'pages.apply.locked' | transloco }}</p>
                @if (reference(); as ref) {
                  <p class="flex flex-wrap items-center gap-3">
                    <span class="t-caption">{{ 'pages.apply.referenceLabel' | transloco }}</span>
                    <bdi dir="ltr" class="font-bold text-heading">{{ ref }}</bdi>
                  </p>
                }
                <a appButton [routerLink]="locale.link('/portal')">{{
                  'pages.apply.goPortal' | transloco
                }}</a>
              </div>
            }
            @default {
              @if (restorable(); as draft) {
                <div
                  class="note flex-col items-start gap-3 sm:flex-row sm:items-center"
                  role="status"
                >
                  <div class="flex grow flex-col gap-1">
                    <strong>{{ 'pages.apply.restoreTitle' | transloco }}</strong>
                    <span>{{
                      'pages.apply.restoreBody' | transloco: { time: time(draft.savedAt) }
                    }}</span>
                  </div>
                  <div class="flex gap-2">
                    <button appButton size="sm" type="button" (click)="restore()">
                      {{ 'pages.apply.restore' | transloco }}
                    </button>
                    <button
                      appButton
                      size="sm"
                      variant="line"
                      type="button"
                      (click)="discardDraft()"
                    >
                      {{ 'pages.apply.discard' | transloco }}
                    </button>
                  </div>
                </div>
              }

              <form
                class="card flex flex-col gap-6 md:!px-11 md:!py-10"
                novalidate
                [attr.aria-labelledby]="'apply-step-' + step()"
                (submit)="onSubmit($event)"
              >
                <div class="flex flex-wrap items-center gap-3">
                  <h2
                    class="t-h3 text-[26px]"
                    [id]="'apply-step-' + step()"
                    tabindex="-1"
                    #stepHeading
                  >
                    {{
                      'pages.apply.stepTitle'
                        | transloco: { n: stepNumber(), title: steps()[step()].label }
                    }}
                  </h2>
                  <span class="pill">{{ 'pages.apply.active' | transloco }}</span>
                </div>

                @if (step() === 0) {
                  <fieldset class="flex flex-col gap-3">
                    <legend class="field-label mb-3">
                      {{ 'pages.apply.fullName' | transloco }}
                      <span class="field-required" aria-hidden="true">*</span>
                    </legend>
                    <div class="grid gap-4 md:grid-cols-3">
                      <app-field
                        [label]="'pages.apply.firstName' | transloco"
                        [state]="f.firstName()"
                        [errors]="srv('firstName')"
                        [forceErrors]="tried()[0]"
                      >
                        <input
                          appControl
                          type="text"
                          autocomplete="given-name"
                          [formField]="f.firstName"
                        />
                      </app-field>
                      <app-field
                        [label]="'pages.apply.middleName' | transloco"
                        [state]="f.middleName()"
                        [errors]="srv('middleName')"
                        [forceErrors]="tried()[0]"
                      >
                        <input
                          appControl
                          type="text"
                          autocomplete="additional-name"
                          [formField]="f.middleName"
                        />
                      </app-field>
                      <app-field
                        [label]="'pages.apply.lastName' | transloco"
                        [state]="f.lastName()"
                        [errors]="srv('lastName')"
                        [forceErrors]="tried()[0]"
                      >
                        <input
                          appControl
                          type="text"
                          autocomplete="family-name"
                          [formField]="f.lastName"
                        />
                      </app-field>
                    </div>
                  </fieldset>
                  <div class="grid gap-5 md:grid-cols-2">
                    <app-field
                      [label]="'pages.apply.birthDate' | transloco"
                      [state]="f.birthDate()"
                      [errors]="srv('birthDate')"
                      [forceErrors]="tried()[0]"
                    >
                      <input
                        appControl
                        type="date"
                        dir="ltr"
                        autocomplete="bday"
                        [max]="today"
                        [formField]="f.birthDate"
                      />
                    </app-field>
                    <app-field
                      [label]="'pages.apply.phone' | transloco"
                      [state]="f.phone()"
                      [errors]="srv('phone')"
                      [forceErrors]="tried()[0]"
                    >
                      <input
                        appControl
                        type="tel"
                        inputmode="tel"
                        dir="ltr"
                        autocomplete="tel"
                        placeholder="+966 5x xxx xxxx"
                        [formField]="f.phone"
                      />
                    </app-field>
                    @if (countries().length) {
                      <app-field
                        [label]="'pages.apply.nationality' | transloco"
                        [state]="f.nationality()"
                        [errors]="srv('nationality')"
                        [forceErrors]="tried()[0]"
                      >
                        <select appControl autocomplete="country" [formField]="f.nationality">
                          <option value="">{{ 'pages.apply.chooseCountry' | transloco }}</option>
                          @for (c of countries(); track c.code) {
                            <option [value]="c.code">{{ c.name }}</option>
                          }
                        </select>
                      </app-field>
                    } @else {
                      <app-field
                        [label]="'pages.apply.nationality' | transloco"
                        [hint]="'pages.apply.countryCode' | transloco"
                        [state]="f.nationality()"
                        [errors]="srv('nationality')"
                        [forceErrors]="tried()[0]"
                      >
                        <input
                          appControl
                          type="text"
                          dir="ltr"
                          autocomplete="country"
                          [formField]="f.nationality"
                        />
                      </app-field>
                    }
                    <app-field
                      [label]="'pages.apply.idNumber' | transloco"
                      [state]="f.idNumber()"
                      [errors]="srv('idNumber')"
                      [forceErrors]="tried()[0]"
                    >
                      <input
                        appControl
                        type="text"
                        dir="ltr"
                        autocomplete="off"
                        [formField]="f.idNumber"
                      />
                    </app-field>
                    <app-field
                      [label]="'pages.apply.email' | transloco"
                      [state]="f.email()"
                      [errors]="srv('email')"
                      [forceErrors]="tried()[0]"
                    >
                      <input
                        appControl
                        type="email"
                        inputmode="email"
                        dir="ltr"
                        autocomplete="email"
                        placeholder="name@example.com"
                        [formField]="f.email"
                      />
                    </app-field>
                    <app-field
                      [label]="'pages.apply.currentJob' | transloco"
                      [state]="f.currentJob()"
                      [errors]="srv('currentJob')"
                      [forceErrors]="tried()[0]"
                    >
                      <input
                        appControl
                        type="text"
                        autocomplete="organization-title"
                        [formField]="f.currentJob"
                      />
                    </app-field>
                  </div>
                  <app-choice-group
                    [legend]="'pages.apply.gender' | transloco"
                    required
                    [columns]="2"
                    [error]="choiceError('gender', 0)"
                  >
                    <label class="choice"
                      ><input type="radio" value="male" [formField]="f.gender" />
                      {{ 'pages.apply.male' | transloco }}</label
                    >
                    <label class="choice"
                      ><input type="radio" value="female" [formField]="f.gender" />
                      {{ 'pages.apply.female' | transloco }}</label
                    >
                  </app-choice-group>
                } @else if (step() === 1) {
                  <div class="grid gap-5 md:grid-cols-2">
                    <app-field
                      [label]="'pages.apply.university' | transloco"
                      [state]="f.university()"
                      [errors]="srv('university')"
                      [forceErrors]="tried()[1]"
                    >
                      <input
                        appControl
                        type="text"
                        autocomplete="organization"
                        [formField]="f.university"
                      />
                    </app-field>
                    <app-field
                      [label]="'pages.apply.major' | transloco"
                      [state]="f.major()"
                      [errors]="srv('major')"
                      [forceErrors]="tried()[1]"
                    >
                      <input appControl type="text" [formField]="f.major" />
                    </app-field>
                  </div>
                  <app-choice-group
                    [legend]="'pages.apply.degreeLevel' | transloco"
                    required
                    [columns]="3"
                    [error]="choiceError('degreeLevel', 1)"
                  >
                    @for (d of degrees; track d) {
                      <label class="choice"
                        ><input type="radio" [value]="d" [formField]="f.degreeLevel" />
                        {{ 'pages.apply.degree.' + d | transloco }}</label
                      >
                    }
                  </app-choice-group>
                  <app-field
                    [label]="'pages.apply.scholarshipNote' | transloco"
                    [state]="f.scholarshipNote()"
                    [errors]="srv('scholarshipNote')"
                    [forceErrors]="tried()[1]"
                  >
                    <textarea appControl rows="5" [formField]="f.scholarshipNote"></textarea>
                  </app-field>
                } @else {
                  <p class="t-muted">{{ 'pages.apply.documentsLead' | transloco }}</p>
                  @if (missingDocs().length) {
                    <p class="note note-warn" role="alert">
                      {{ 'pages.apply.missingDocs' | transloco: { types: missingLabels() } }}
                    </p>
                  }
                  <app-apply-documents
                    [missing]="missingDocs()"
                    [disabled]="busy()"
                    (changed)="documents.set($event)"
                  />
                  <div class="flex flex-col gap-2">
                    <label class="check items-start">
                      <input
                        type="checkbox"
                        [formField]="f.consent"
                        [attr.aria-describedby]="consentError() ? 'apply-consent-error' : null"
                      />
                      <span>{{ 'pages.apply.consent' | transloco }}</span>
                    </label>
                    @if (consentError()) {
                      <p id="apply-consent-error" class="field-error" role="alert">
                        {{ 'validation.required' | transloco }}
                      </p>
                    }
                  </div>
                }

                @if (errorKey(); as key) {
                  <p class="note note-warn" role="alert">{{ key | transloco }}</p>
                }

                <div
                  class="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"
                >
                  @if (step() === 0) {
                    <button
                      appButton
                      variant="line"
                      type="button"
                      [disabled]="busy()"
                      (click)="saveNow()"
                    >
                      {{ 'pages.apply.saveDraft' | transloco }}
                    </button>
                  } @else {
                    <button
                      appButton
                      variant="line"
                      type="button"
                      [disabled]="busy()"
                      (click)="goTo(step() - 1)"
                    >
                      {{ 'pages.apply.back' | transloco }}
                    </button>
                  }
                  <p class="t-caption sm:ms-auto sm:me-4" aria-live="polite" data-testid="autosave">
                    {{ saveText() }}
                  </p>
                  <button appButton type="submit" [busy]="busy()" [disabled]="busy()">
                    {{ primaryLabel() | transloco }}
                  </button>
                </div>
              </form>
            }
          }
        </div>

        <aside class="flex flex-col gap-5">
          <div class="card band border-0">
            <h2 class="t-h4">{{ 'pages.apply.progressTitle' | transloco }}</h2>
            <app-progress class="my-4" [value]="progressPercent()" [label]="progressText()" />
            <p class="text-band-soft">{{ progressText() }}</p>
            <p class="t-caption mt-4 border-t border-band-card pt-4 !text-band-soft">
              {{
                savedAt()
                  ? ('pages.apply.lastSaved' | transloco: { time: time(savedAt()!) })
                  : ('pages.apply.notSaved' | transloco)
              }}
            </p>
          </div>
          <div class="card flex flex-col gap-4">
            <h2 class="t-h4 text-[19px]">{{ 'pages.apply.checklistTitle' | transloco }}</h2>
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              @for (item of checklist; track item) {
                <li class="flex items-start gap-3">
                  <app-icon name="check" class="mt-1 shrink-0 text-secondary" />
                  <span>{{ 'pages.apply.checklist.' + item | transloco }}</span>
                </li>
              }
            </ul>
          </div>
          <p class="note">
            <app-icon name="lock" class="shrink-0" /> {{ 'pages.apply.privacy' | transloco }}
          </p>
        </aside>
      </div>
    </section>
  `,
})
export class ApplyPage {
  /** Resolved countries (may be empty). */
  readonly data = input<Country[]>([]);

  protected readonly locale = inject(LocaleService);
  private readonly portal = inject(PortalApi);
  private readonly session = inject(ApplicantSessionStore);
  private readonly t = inject(TranslocoService);
  private readonly seo = inject(SeoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly degrees = ['bachelor', 'master', 'phd'] as const;
  protected readonly checklist = ['id', 'certificates', 'university'] as const;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly countries = computed(() => {
    const collator = new Intl.Collator(this.locale.lang());
    return [...this.data()].sort((a, b) => collator.compare(a.name, b.name));
  });
  protected readonly steps = computed(() => {
    this.locale.lang();
    return [
      { label: this.t.translate('pages.apply.steps.personal') },
      { label: this.t.translate('pages.apply.steps.study') },
      { label: this.t.translate('pages.apply.steps.documents') },
    ];
  });

  protected readonly value = signal<ApplyFormValue>(emptyApplyValue());
  protected readonly f = form(this.value, (p) => {
    for (const name of [p.firstName, p.lastName]) {
      required(name);
      maxLength(name, 120);
      pattern(name, NAME_PATTERN, { message: this.t.translate('pages.apply.nameInvalid') });
    }
    maxLength(p.middleName, 120);
    pattern(p.middleName, NAME_PATTERN, { message: this.t.translate('pages.apply.nameInvalid') });
    required(p.birthDate);
    validate(p.birthDate, ({ value }) =>
      value() && value() > new Date().toISOString().slice(0, 10)
        ? { kind: 'birthDateFuture', message: this.t.translate('pages.apply.birthDateFuture') }
        : undefined,
    );
    required(p.phone);
    minLength(p.phone, 5);
    maxLength(p.phone, 40);
    pattern(p.phone, PHONE_PATTERN, { message: this.t.translate('pages.apply.phoneInvalid') });
    required(p.nationality);
    pattern(p.nationality, /^[A-Za-z]{2}$/);
    maxLength(p.idNumber, 40);
    required(p.email);
    email(p.email);
    maxLength(p.email, 191);
    maxLength(p.currentJob, 191);
    required(p.gender);
    required(p.university);
    maxLength(p.university, 191);
    required(p.major);
    maxLength(p.major, 191);
    required(p.degreeLevel);
    maxLength(p.scholarshipNote, 5000);
    required(p.consent);
  });

  protected readonly phase = signal<Phase>('form');
  protected readonly step = signal(0);
  protected readonly stepNumber = computed(() => {
    const n = String(this.step() + 1);
    return this.locale.lang() === 'ar' ? toArabicDigits(n) : n;
  });
  protected readonly tried = signal<[boolean, boolean, boolean]>([false, false, false]);
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly reference = signal<string | null>(null);
  protected readonly documents = signal<ApplicantDocument[]>([]);
  protected readonly missingDocs = signal<DocType[]>([]);
  protected readonly restorable = signal<{ savedAt: number; value: StoredDraft } | null>(null);

  protected readonly saveState = signal<SaveState>('idle');
  protected readonly savedAt = signal<number | null>(null);
  /** What the server has; autosave sends the difference. */
  private synced: ApplyFormValue | null = null;
  /** API field errors, kept while the field still holds the rejected value. */
  private readonly serverErrors = signal<{
    errors: Record<string, string[]>;
    at: ApplyFormValue;
  } | null>(null);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private retries = 0;
  private browser = false;

  protected readonly completed = computed(() => {
    const done: number[] = [];
    if (this.reference()) done.push(0);
    if (this.step() > 1) done.push(1);
    return done;
  });
  protected readonly progressPercent = computed(() =>
    Math.round((this.completed().length / 3) * 100),
  );
  protected readonly progressText = computed(() => {
    const n = this.completed().length;
    return this.t.translate('pages.apply.progressLabel', {
      done: this.locale.lang() === 'ar' ? toArabicDigits(String(n)) : n,
    });
  });
  protected readonly saveText = computed(() => {
    switch (this.saveState()) {
      case 'saving':
        return this.t.translate('pages.apply.saving');
      case 'saved':
        return this.t.translate('pages.apply.saved', {
          time: this.time(this.savedAt() ?? Date.now()),
        });
      case 'offline':
        return this.t.translate('pages.apply.savedOnDevice');
      default:
        return '';
    }
  });
  protected readonly consentError = computed(() => this.tried()[2] && this.f.consent().invalid());
  protected readonly missingLabels = computed(() =>
    this.missingDocs()
      .map((d) => this.t.translate(`docType.${d}`))
      .join(this.locale.lang() === 'ar' ? '، ' : ', '),
  );
  protected readonly primaryLabel = computed(() => {
    if (this.busy()) {
      return this.step() === 2 ? 'pages.apply.submitting' : 'pages.apply.saving';
    }
    return ['pages.apply.next1', 'pages.apply.next2', 'pages.apply.submit'][this.step()];
  });

  constructor() {
    effect(() =>
      this.seo.set({
        title: this.t.translate('pages.apply.title'),
        description: this.t.translate('pages.apply.lead'),
        path: '/apply',
        lang: this.locale.lang(),
      }),
    );

    // Autosave: any change after the application exists, debounced (browser only).
    effect(() => {
      const v = this.value();
      if (!this.browser || !this.synced || this.phase() !== 'form') {
        return;
      }
      untracked(() => this.schedule(v));
    });

    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));

    afterNextRender(() => {
      this.browser = true;
      const draft = loadDraft();
      void this.resume(draft);
    });
  }

  // ---------- template helpers ----------

  protected srv(field: ApplyField): FieldErrorLike[] {
    const s = this.serverErrors();
    if (!s || s.at[field] !== this.value()[field]) {
      return [];
    }
    return (s.errors[field] ?? []).map((message) => ({ kind: 'server', message }));
  }

  protected choiceError(field: 'gender' | 'degreeLevel', step: number): string | null {
    const state = this.f[field]();
    if ((this.tried()[step] || state.touched()) && state.invalid()) {
      return this.t.translate('validation.required');
    }
    return this.srv(field)[0]?.message ?? null;
  }

  protected time(ms: number): string {
    return new Intl.DateTimeFormat(this.locale.intlLocale(), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(ms);
  }

  // ---------- resume / draft ----------

  private async resume(draft: { savedAt: number; value: StoredDraft } | null): Promise<void> {
    if (!(await this.session.ensureLoaded())) {
      return;
    }
    const me = this.session.me();
    if (!me) {
      return;
    }
    this.reference.set(me.reference);
    if (me.status !== 'draft') {
      this.phase.set('locked');
      return;
    }
    const value = fromMe(me);
    this.synced = value;
    this.value.set(value);
    this.step.set(Math.min(Math.max(me.currentStep, 0), 2));
    if (draft && changedFields(value, { ...value, ...draft.value }).length) {
      this.restorable.set(draft);
    }
  }

  protected restore(): void {
    const draft = this.restorable();
    if (draft) {
      this.value.update((v) => ({ ...v, ...draft.value }));
    }
    this.restorable.set(null);
  }

  protected discardDraft(): void {
    clearDraft();
    this.restorable.set(null);
  }

  // ---------- autosave ----------

  private schedule(value: ApplyFormValue): void {
    clearTimeout(this.timer);
    if (!this.synced || !changedFields(this.synced, value).length) {
      return;
    }
    this.timer = setTimeout(() => void this.autosave(), AUTOSAVE_DEBOUNCE_MS);
  }

  /** Sends the changed fields that are currently valid. Resolves `true` when nothing is pending. */
  private async autosave(): Promise<boolean> {
    clearTimeout(this.timer);
    const base = this.synced;
    if (!base || !this.session.canWrite()) {
      return false;
    }
    const value = this.value();
    const fields = changedFields(base, value).filter((k) => this.f[k]().valid());
    if (!fields.length) {
      return true;
    }
    this.saveState.set('saving');
    try {
      await firstValueFrom(this.portal.patch(toPatch(value, fields)));
      const next = { ...base };
      for (const k of fields) {
        (next as Record<string, unknown>)[k] = value[k];
      }
      this.synced = next;
      this.retries = 0;
      this.savedAt.set(Date.now());
      this.saveState.set('saved');
      clearDraft();
      if (changedFields(next, this.value()).length) {
        this.schedule(this.value());
      }
      return true;
    } catch (error) {
      this.handleSaveError(toApiProblem(error), value);
      return false;
    }
  }

  private handleSaveError(problem: ApiProblem, value: ApplyFormValue): void {
    if (problem.status === 0 || problem.status >= 500 || problem.code === 'NETWORK') {
      saveDraft(value);
      this.saveState.set('offline');
      const delay = RETRY_BACKOFF_MS[Math.min(this.retries++, RETRY_BACKOFF_MS.length - 1)];
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.autosave(), delay);
      return;
    }
    if (problem.code === 'APPLICATION_LOCKED') {
      this.phase.set('locked');
      return;
    }
    this.saveState.set('error');
    this.showProblem(problem, value);
  }

  private showProblem(problem: ApiProblem, value: ApplyFormValue): void {
    this.errorKey.set(problemMessageKey(problem));
    if (Object.keys(problem.fieldErrors).length) {
      this.serverErrors.set({ errors: problem.fieldErrors, at: value });
    }
  }

  // ---------- navigation ----------

  protected async saveNow(): Promise<void> {
    if (!this.synced) {
      await this.next();
      return;
    }
    await this.autosave();
  }

  protected goTo(step: number): void {
    this.errorKey.set(null);
    this.step.set(step);
    this.focusHeading();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.step() === 2) {
      await this.submitApplication();
    } else {
      await this.next();
    }
  }

  private stepValid(step: number): boolean {
    const fields: readonly ApplyField[] = step === 0 ? STEP1_FIELDS : STEP2_FIELDS;
    this.tried.update(
      (t) => t.map((v, i) => (i === step ? true : v)) as [boolean, boolean, boolean],
    );
    fields.forEach((k) => this.f[k]().markAsTouched());
    return fields.every((k) => this.f[k]().valid());
  }

  private async next(): Promise<void> {
    this.errorKey.set(null);
    const step = this.step();
    if (!this.stepValid(step)) {
      this.focusFirstInvalid();
      return;
    }
    this.busy.set(true);
    try {
      if (!this.synced) {
        const value = this.value();
        const res = await firstValueFrom(this.portal.createApplication(toStep1(value)));
        this.session.startSession(res.csrfToken);
        this.reference.set(res.reference);
        this.synced = value;
        this.savedAt.set(Date.now());
        this.saveState.set('saved');
      } else if (!(await this.autosave()) && this.saveState() !== 'offline') {
        return;
      }
      this.goTo(step + 1);
    } catch (error) {
      const problem = toApiProblem(error);
      if (problem.code === 'APPLICATION_EXISTS') {
        this.phase.set('exists');
      } else {
        this.showProblem(problem, this.value());
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async submitApplication(): Promise<void> {
    this.errorKey.set(null);
    this.tried.set([true, true, true]);
    this.f.consent().markAsTouched();
    if (!this.stepValid(0) || !this.stepValid(1)) {
      this.goTo(this.stepValid(0) ? 1 : 0);
      return;
    }
    if (!this.f.consent().valid()) {
      return;
    }
    this.busy.set(true);
    try {
      const value = this.value();
      await firstValueFrom(
        this.portal.submit(toPatch(value, [...STEP1_FIELDS, ...STEP2_FIELDS, 'consent'])),
      );
      clearTimeout(this.timer);
      clearDraft();
      this.phase.set('success');
      void this.session.refresh();
      setTimeout(() =>
        this.host.nativeElement.querySelector<HTMLElement>('[role="status"][tabindex]')?.focus(),
      );
    } catch (error) {
      const problem = toApiProblem(error);
      if (problem.code === 'DOCUMENTS_INCOMPLETE') {
        const missing = problem.extra['missing'];
        this.missingDocs.set(Array.isArray(missing) ? (missing as DocType[]) : []);
      } else if (problem.code === 'APPLICATION_LOCKED') {
        this.phase.set('locked');
        return;
      }
      this.showProblem(problem, this.value());
    } finally {
      this.busy.set(false);
    }
  }

  private focusHeading(): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('form h2')?.focus());
  }

  private focusFirstInvalid(): void {
    setTimeout(() =>
      this.host.nativeElement.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus(),
    );
  }
}
