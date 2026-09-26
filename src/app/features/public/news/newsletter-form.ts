import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { email, form, FormField, maxLength, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { PublicApi } from '../../../core/api/public-api';
import { problemToTreeErrors } from '../../../shared/forms/server-errors';
import { Button } from '../../../shared/ui/button/button';
import { Control, Field } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Newsletter band (prototype news page footer band): email + honeypot + `formRenderedAt` (set in the
 * browser, F12) → POST /newsletter. Double opt-in (C27): `pendingConfirmation` asks the visitor to
 * open the confirmation email.
 */
@Component({
  selector: 'app-newsletter-form',
  imports: [TranslocoPipe, FormField, Button, Control, Field, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block bg-surface py-12 md:py-16' },
  template: `
    <div class="wrap grid items-center gap-8 lg:grid-cols-2">
      <div class="flex flex-col gap-2">
        <h2 id="newsletter-title" class="t-h3">{{ 'pages.news.newsletter.title' | transloco }}</h2>
        <p class="t-muted">{{ 'pages.news.newsletter.lead' | transloco }}</p>
      </div>
      @if (result(); as r) {
        <p class="note note-ok" role="status">
          <app-icon name="circle-check" />
          {{
            (r === 'pending' ? 'pages.news.newsletter.pending' : 'pages.news.newsletter.done')
              | transloco
          }}
        </p>
      } @else {
        <form
          class="flex flex-col gap-3 sm:flex-row sm:items-start"
          novalidate
          aria-labelledby="newsletter-title"
          (submit)="onSubmit($event)"
        >
          <app-field
            class="grow"
            [label]="'pages.news.newsletter.email' | transloco"
            [state]="model.email()"
            [forceErrors]="tried()"
          >
            <input
              appControl
              type="email"
              inputmode="email"
              autocomplete="email"
              dir="ltr"
              placeholder="name@example.com"
              [formField]="model.email"
            />
          </app-field>
          <div class="sr-only" aria-hidden="true">
            <label for="newsletter-website">{{
              'pages.news.newsletter.honeypot' | transloco
            }}</label>
            <input
              id="newsletter-website"
              type="text"
              tabindex="-1"
              autocomplete="off"
              [formField]="model.website"
            />
          </div>
          <button appButton class="sm:mt-8" type="submit" [busy]="busy()" [disabled]="busy()">
            {{
              (busy() ? 'pages.news.newsletter.subscribing' : 'pages.news.newsletter.subscribe')
                | transloco
            }}
          </button>
        </form>
        @if (errorKey(); as key) {
          <p class="note note-warn lg:col-start-2" role="alert">{{ key | transloco }}</p>
        }
      }
    </div>
  `,
})
export class NewsletterForm {
  private readonly api = inject(PublicApi);
  private readonly value = signal({ email: '', website: '' });
  protected readonly model = form(this.value, (p) => {
    required(p.email);
    email(p.email);
    maxLength(p.email, 191);
  });
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly result = signal<'pending' | 'done' | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  private formRenderedAt: number | null = null;

  constructor() {
    afterNextRender(() => (this.formRenderedAt = Date.now()));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    await submit(this.model, async () => {
      this.busy.set(true);
      try {
        const v = this.value();
        const res = await firstValueFrom(
          this.api.newsletter({
            email: v.email.trim(),
            website: v.website,
            formRenderedAt: this.formRenderedAt ?? Date.now(),
          }),
        );
        this.result.set(res.pendingConfirmation ? 'pending' : 'done');
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
