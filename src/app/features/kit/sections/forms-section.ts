import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '../../../shared/ui/button/button';
import { ChoiceGroup } from '../../../shared/ui/choice/choice';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Control, Field } from '../../../shared/ui/field/field';
import { FileDrop } from '../../../shared/ui/file-drop/file-drop';
import type { FileRejection } from '../../../shared/ui/file-drop/validate-files';
import { Note } from '../../../shared/ui/note/note';
import { OtpInput } from '../../../shared/ui/otp-input/otp-input';
import { Progress } from '../../../shared/ui/progress/progress';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { Pill } from '../../../shared/ui/status-pill/status-pill';
import { Stepper } from '../../../shared/ui/stepper/stepper';
import { Timeline, TimelineItem, TimelineItemState } from '../../../shared/ui/timeline/timeline';

const TIMELINE_KEYS = ['one', 'two', 'three', 'four', 'five'];

/** Demo timelines: `done` steps are complete, `now` is the current one (null: none). */
function demoTimeline(done: number, now: boolean): TimelineItem[] {
  return TIMELINE_KEYS.map((key, i) => {
    const state: TimelineItemState = i < done ? 'done' : now && i === done ? 'now' : 'pending';
    return { key, label: `[${key}]`, state, caption: state === 'done' ? '[...]' : null };
  });
}

/** Kit statuses for the generic pill demo. */
const DEMO_PILLS = [
  ['teal', 'teal'],
  ['ok', 'ok'],
  ['warn', 'warn'],
  ['plain', 'plain'],
  ['solid', 'solid'],
] as const;

/** Kit: file drop, stepper, timeline, OTP, pills, progress, notes, skeleton, empty state, choices. */
@Component({
  selector: 'app-kit-forms-section',
  imports: [
    TranslocoPipe,
    FormField,
    Button,
    ChoiceGroup,
    Control,
    EmptyState,
    Field,
    FileDrop,
    Note,
    OtpInput,
    Pill,
    Progress,
    Skeleton,
    Stepper,
    Timeline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-12' },
  template: `
    <section aria-labelledby="kit-file-drop" class="flex flex-col gap-4">
      <h2 id="kit-file-drop" class="t-h4">FileDrop</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <p class="t-caption">idle (try a .gif or a file over 5 MB)</p>
          <app-file-drop (filesSelected)="picked.set($event)" (rejected)="onRejected($event)" />
          <p class="t-caption" aria-live="polite">
            @for (f of picked(); track $index) {
              <bdi>{{ f.name }}</bdi>
            }
            @if (rejectedCount()) {
              · rejected: {{ rejectedCount() }}
            }
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <p class="t-caption">drag-over look</p>
          <app-file-drop highlight label="[...] 1" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="t-caption">uploading 40%</p>
          <app-file-drop status="uploading" [progress]="40" label="[...] 2" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="t-caption">done</p>
          <app-file-drop status="done" label="[...] 3" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="t-caption">error (server)</p>
          <app-file-drop status="error" [error]="'errors.generic' | transloco" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="t-caption">disabled</p>
          <app-file-drop disabled />
        </div>
      </div>
    </section>

    <section aria-labelledby="kit-stepper" class="flex flex-col gap-6">
      <h2 id="kit-stepper" class="t-h4">Stepper</h2>
      @for (i of [0, 1, 2]; track i) {
        <app-stepper [steps]="steps" [current]="i" />
      }
    </section>

    <section aria-labelledby="kit-timeline" class="flex flex-col gap-6">
      <h2 id="kit-timeline" class="t-h4">Timeline</h2>
      @for (t of timelines; track $index) {
        <div class="card flex flex-col gap-4">
          <app-timeline [items]="t" />
        </div>
      }
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="card min-w-0">
          <app-timeline orientation="vertical" [items]="timelines[1]" />
        </div>
        <!-- Forced horizontal only makes sense with room: shown from md up. -->
        <div class="card hidden min-w-0 md:col-span-2 md:block">
          <app-timeline orientation="horizontal" [items]="timelines[2]" />
        </div>
      </div>
    </section>

    <section aria-labelledby="kit-otp" class="flex flex-col gap-4">
      <h2 id="kit-otp" class="t-h4">OTP input</h2>
      <div class="grid gap-6 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <p class="t-caption">empty</p>
          <app-otp-input (completed)="otpDone.set($event)" />
          <p class="t-caption" aria-live="polite">
            completed: <bdi dir="ltr">{{ otpDone() }}</bdi>
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <p class="t-caption">filled</p>
          <app-otp-input value="123456" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="t-caption">invalid</p>
          <app-otp-input value="12" invalid touched describedBy="kit-otp-err" />
          <p id="kit-otp-err" class="field-error">{{ 'errors.generic' | transloco }}</p>
        </div>
        <div class="flex flex-col gap-2">
          <p class="t-caption">disabled</p>
          <app-otp-input value="123" disabled />
        </div>
      </div>
    </section>

    <section aria-labelledby="kit-pills" class="flex flex-col gap-4">
      <h2 id="kit-pills" class="t-h4">Pills</h2>
      <div class="flex flex-wrap gap-2">
        @for (p of pills; track p[0]) {
          <app-pill [variant]="p[0]">{{ 'kit.status.' + p[1] | transloco }}</app-pill>
        }
      </div>
      <div class="flex flex-wrap gap-2">
        <app-pill>teal</app-pill>
        <app-pill variant="ok">ok</app-pill>
        <app-pill variant="warn">warn</app-pill>
        <app-pill variant="plain">plain</app-pill>
        <app-pill variant="solid">solid</app-pill>
      </div>
    </section>

    <section aria-labelledby="kit-progress" class="flex flex-col gap-4">
      <h2 id="kit-progress" class="t-h4">Progress</h2>
      <app-progress [value]="0" label="[...] 0" showValue />
      <app-progress [value]="66" label="[...] 66" showValue />
      <app-progress [value]="100" label="[...] 100" />
    </section>

    <section aria-labelledby="kit-notes" class="flex flex-col gap-4">
      <h2 id="kit-notes" class="t-h4">Notes</h2>
      <app-note>info · [...]</app-note>
      <app-note kind="warn">warn · [...]</app-note>
      <app-note kind="ok" icon="badge-check">ok · [...]</app-note>
    </section>

    <section aria-labelledby="kit-skeleton" class="flex flex-col gap-4" aria-busy="true">
      <h2 id="kit-skeleton" class="t-h4">Skeleton</h2>
      <p class="sr-only">{{ 'common.loading' | transloco }}</p>
      <div class="flex items-center gap-4">
        <app-skeleton width="56px" height="56px" rounded />
        <app-skeleton class="grow" [lines]="2" />
      </div>
      <app-skeleton height="160px" />
      <app-skeleton [lines]="4" width="80%" />
    </section>

    <section aria-labelledby="kit-empty" class="flex flex-col gap-4">
      <h2 id="kit-empty" class="t-h4">Empty state</h2>
      <div class="card">
        <app-empty-state icon="file-text" body="[...]">
          <button appButton size="sm" type="button">[...]</button>
        </app-empty-state>
      </div>
    </section>

    <section aria-labelledby="kit-choices" class="flex flex-col gap-4">
      <h2 id="kit-choices" class="t-h4">Choices + Signal Forms</h2>
      <form class="grid gap-5 md:grid-cols-2" novalidate (submit)="submit($event)">
        <app-field label="[...] email" [state]="f.email()" [forceErrors]="submitted()">
          <input appControl type="email" dir="ltr" autocomplete="email" [formField]="f.email" />
        </app-field>
        <app-field label="[...] name" [state]="f.name()" [forceErrors]="submitted()">
          <input appControl type="text" autocomplete="name" [formField]="f.name" />
        </app-field>
        <app-choice-group
          class="md:col-span-2"
          legend="[...] track"
          hint="[...]"
          required
          [columns]="2"
          [error]="
            (submitted() || f.track().touched()) && f.track().invalid()
              ? ('validation.required' | transloco)
              : null
          "
        >
          <label class="choice"
            ><input type="radio" value="a" [formField]="f.track" /> [...] A</label
          >
          <label class="choice"
            ><input type="radio" value="b" [formField]="f.track" /> [...] B</label
          >
        </app-choice-group>
        <div class="flex flex-col gap-2 md:col-span-2">
          <p id="kit-otp-label" class="field-label">{{ 'ui.otp.label' | transloco }}</p>
          <app-otp-input class="self-start" labelledBy="kit-otp-label" [formField]="f.code" />
        </div>
        <label class="check md:col-span-2">
          <input type="checkbox" [formField]="f.agree" />
          <span>[...] agree</span>
        </label>
        <div class="md:col-span-2">
          <button appButton type="submit">{{ 'common.save' | transloco }}</button>
        </div>
        @if (submitted() && f().valid()) {
          <app-note class="md:col-span-2" kind="ok" live>{{ 'common.saved' | transloco }}</app-note>
        }
      </form>
    </section>
  `,
})
export class KitFormsSection {
  protected readonly pills = DEMO_PILLS;
  protected readonly steps = [{ label: '[...] 1' }, { label: '[...] 2' }, { label: '[...] 3' }];
  protected readonly timelines = [
    demoTimeline(0, false),
    demoTimeline(2, true),
    demoTimeline(3, true),
    demoTimeline(5, false),
  ];

  protected readonly picked = signal<File[]>([]);
  protected readonly rejectedCount = signal(0);
  protected readonly otpDone = signal('');
  protected readonly submitted = signal(false);

  private readonly model = signal({ email: '', name: '', track: '', code: '', agree: false });
  protected readonly f = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.name);
    required(p.track);
    required(p.code);
  });

  protected onRejected(rejections: FileRejection[]): void {
    this.rejectedCount.set(rejections.length);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
  }
}
