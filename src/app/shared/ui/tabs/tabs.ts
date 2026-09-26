import { Directionality } from '@angular/cdk/bidi';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  TemplateRef,
  viewChildren,
} from '@angular/core';

let nextTabsId = 0;

/**
 * Optional lazy body for a tab: `<ng-template appTabContent>…</ng-template>` inside `<app-tab>` is
 * rendered the first time the tab is selected (and kept afterwards). Plain projected content is
 * always rendered, which keeps it in the SSR output.
 */
@Directive({ selector: 'ng-template[appTabContent]' })
export class TabContent {
  readonly template = inject(TemplateRef);
}

/** One tab panel. The host element is the `tabpanel`; inactive panels stay in the DOM, `hidden`. */
@Component({
  selector: 'app-tab',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary',
    role: 'tabpanel',
    tabindex: '0',
    '[id]': 'panelId()',
    '[attr.aria-labelledby]': 'tabId()',
    '[hidden]': '!active()',
  },
  template: `
    <ng-content />
    @if (lazy(); as tpl) {
      @if (activated()) {
        <ng-container [ngTemplateOutlet]="tpl.template" />
      }
    }
  `,
})
export class Tab {
  private readonly tabs = inject(forwardRef(() => Tabs));

  readonly label = input.required<string>();
  readonly disabled = input(false);

  protected readonly lazy = contentChild(TabContent);
  readonly index = computed(() => this.tabs.tabs().indexOf(this));
  readonly active = computed(() => this.tabs.selected() === this.index());
  readonly tabId = computed(() => `${this.tabs.id}-tab-${this.index()}`);
  readonly panelId = computed(() => `${this.tabs.id}-panel-${this.index()}`);
  protected readonly activated = signal(false);

  constructor() {
    effect(() => {
      if (this.active()) {
        this.activated.set(true);
      }
    });
  }
}

/**
 * WAI-ARIA tabs (automatic activation): roving tabindex, Arrow keys follow the reading direction
 * (in RTL ArrowLeft moves to the next tab), Home/End, disabled tabs are skipped.
 *
 *   <app-tabs [(selectedIndex)]="tab" [label]="'…' | transloco">
 *     <app-tab [label]="'…' | transloco">…</app-tab>
 *   </app-tabs>
 */
@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5' },
  template: `
    <div
      class="flex gap-1 overflow-x-auto border-b border-border"
      role="tablist"
      [attr.aria-label]="label() || null"
      (keydown)="onKeydown($event)"
    >
      @for (tab of tabs(); track tab; let i = $index) {
        <button
          #tabButton
          type="button"
          role="tab"
          class="-mb-px min-h-11 shrink-0 cursor-pointer border-b-2 px-4 font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          [class]="
            i === selected()
              ? 'border-primary font-semibold text-heading'
              : 'border-transparent text-text-muted hover:text-text'
          "
          [id]="tab.tabId()"
          [attr.aria-selected]="i === selected()"
          [attr.aria-controls]="tab.panelId()"
          [attr.tabindex]="i === selected() ? 0 : -1"
          [disabled]="tab.disabled()"
          (click)="select(i)"
        >
          {{ tab.label() }}
        </button>
      }
    </div>
    <ng-content />
  `,
})
export class Tabs {
  private readonly dir = inject(Directionality);

  readonly id = `app-tabs-${++nextTabsId}`;
  readonly selectedIndex = model(0);
  readonly label = input<string>('');

  readonly tabs = contentChildren(Tab);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  /** Clamped selection so a stale index never leaves every panel hidden. */
  readonly selected = computed(() => {
    const count = this.tabs().length;
    return count === 0 ? -1 : Math.min(Math.max(this.selectedIndex(), 0), count - 1);
  });

  select(index: number): void {
    const tab = this.tabs()[index];
    if (tab && !tab.disabled()) {
      this.selectedIndex.set(index);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.tabs().length;
    if (count === 0) {
      return;
    }
    const rtl = this.dir.value === 'rtl';
    const current = this.selected();
    let target: number;
    let step = 1;
    switch (event.key) {
      case 'ArrowRight':
        step = rtl ? -1 : 1;
        target = current + step;
        break;
      case 'ArrowLeft':
        step = rtl ? 1 : -1;
        target = current + step;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = count - 1;
        step = -1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = this.nextEnabled(target, step, count);
    if (next !== -1) {
      this.select(next);
      this.buttons()[next]?.nativeElement.focus();
    }
  }

  /** First enabled index from `start` walking by `step`, wrapping around. */
  private nextEnabled(start: number, step: number, count: number): number {
    for (let n = 0; n < count; n++) {
      const i = (((start + step * n) % count) + count) % count;
      if (!this.tabs()[i].disabled()) {
        return i;
      }
    }
    return -1;
  }
}
