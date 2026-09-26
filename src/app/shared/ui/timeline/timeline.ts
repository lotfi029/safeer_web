import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

export type TimelineItemState = 'done' | 'now' | 'pending';

export interface TimelineItem {
  key: string;
  label: string;
  state: TimelineItemState;
  caption?: string | null;
}

export type TimelineOrientation = 'auto' | 'vertical' | 'horizontal';

/*
 * Layout classes per orientation. `auto` = vertical below md, horizontal from md. Written out in
 * full (not concatenated) so Tailwind's scanner sees every class.
 */
const LAYOUT = {
  vertical: {
    list: 'flex flex-col',
    item: 'flex flex-row gap-5',
    rail: 'flex w-10 shrink-0 flex-col items-center',
    line: 'min-h-9 w-0.5 grow',
    body: 'pb-6 pt-2',
  },
  horizontal: {
    list: 'flex flex-row',
    item: 'flex basis-0 grow flex-col gap-3',
    rail: 'flex w-full flex-row items-center',
    line: 'h-0.5 min-w-4 grow',
    body: 'pe-4',
  },
  auto: {
    list: 'flex flex-col md:flex-row',
    item: 'flex flex-row gap-5 md:basis-0 md:grow md:flex-col md:gap-3',
    rail: 'flex w-10 shrink-0 flex-col items-center md:w-full md:flex-row',
    line: 'min-h-9 w-0.5 grow md:h-0.5 md:min-h-0 md:w-auto md:min-w-4',
    body: 'pb-6 pt-2 md:pb-0 md:pt-0 md:pe-4',
  },
} as const;

/**
 * Application progress timeline (prototype `.step/.rail/.dot`): done = filled primary + check,
 * now = secondary with a light ring, pending = bordered. Semantic `<ol>`; each item states its
 * status in visually-hidden text and the current one has aria-current="step".
 */
@Component({
  selector: 'app-timeline',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ol class="m-0 list-none p-0" [class]="layout().list" [attr.aria-label]="'ui.timeline.label' | transloco">
      @for (item of items(); track item.key; let last = $last) {
        <li [class]="layout().item" [attr.aria-current]="item.state === 'now' ? 'step' : null">
          <span [class]="layout().rail" aria-hidden="true">
            @switch (item.state) {
              @case ('done') {
                <span class="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-on-primary">
                  <app-icon name="check" [size]="18" />
                </span>
              }
              @case ('now') {
                <span class="flex size-10 shrink-0 items-center justify-center rounded-full border-[3px] border-secondary-light bg-secondary">
                  <span class="block size-2.5 rounded-full bg-on-primary"></span>
                </span>
              }
              @default {
                <span class="block size-10 shrink-0 rounded-full border-2 border-border bg-card"></span>
              }
            }
            @if (!last) {
              <span class="block rounded-full" [class]="layout().line + (item.state === 'done' ? ' bg-primary' : ' bg-border')"></span>
            }
          </span>
          <span class="flex min-w-0 flex-col gap-1" [class]="layout().body">
            <span class="font-semibold" [class.text-heading]="item.state !== 'pending'" [class.text-text-muted]="item.state === 'pending'">
              {{ item.label }}
              <span class="sr-only">({{ 'ui.timeline.' + item.state | transloco }})</span>
            </span>
            @if (item.caption) {
              <span class="t-caption">{{ item.caption }}</span>
            }
          </span>
        </li>
      }
    </ol>
  `,
})
export class Timeline {
  readonly items = input.required<readonly TimelineItem[]>();
  readonly orientation = input<TimelineOrientation>('auto');

  protected readonly layout = computed(() => LAYOUT[this.orientation()]);
}
