import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconButton } from '../button/button';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icon-names';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastOptions {
  message: string;
  kind?: ToastKind;
  /** Milliseconds before auto-dismiss; 0 keeps the toast until dismissed. Default 5000 (errors 8000). */
  duration?: number;
}

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  duration: number;
}

/**
 * Transient notifications rendered by `<app-toast-outlet>` (put one in each shell). Auto-dismiss
 * timers run in the browser only, so a toast queued during SSR never leaks a server timer.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly list = signal<readonly Toast[]>([]);
  private nextId = 0;

  readonly toasts = this.list.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  show(options: ToastOptions): number {
    const kind = options.kind ?? 'info';
    const toast: Toast = {
      id: ++this.nextId,
      message: options.message,
      kind,
      duration: options.duration ?? (kind === 'error' ? 8000 : 5000),
    };
    this.list.update((list) => [...list, toast]);
    if (this.isBrowser && toast.duration > 0) {
      this.timers.set(
        toast.id,
        setTimeout(() => this.dismiss(toast.id), toast.duration),
      );
    }
    return toast.id;
  }

  info(message: string, duration?: number): number {
    return this.show({ message, kind: 'info', duration });
  }

  success(message: string, duration?: number): number {
    return this.show({ message, kind: 'success', duration });
  }

  error(message: string, duration?: number): number {
    return this.show({ message, kind: 'error', duration });
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.list.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.list.set([]);
  }
}

const ICONS: Record<ToastKind, IconName> = {
  info: 'info',
  success: 'circle-check',
  error: 'circle-alert',
};

/**
 * Fixed at the block-end / inline-end corner. Two live regions that always exist in the DOM (so
 * screen readers pick up insertions): polite `status` for info/success, assertive `alert` for errors.
 */
@Component({
  selector: 'app-toast-outlet',
  imports: [NgTemplateOutlet, TranslocoPipe, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="pointer-events-none fixed start-4 end-4 bottom-4 z-[1100] flex flex-col gap-3 sm:start-auto sm:w-96"
      [attr.aria-label]="'ui.toast.region' | transloco"
    >
    <div class="flex flex-col gap-3" role="status" aria-live="polite" aria-atomic="false">
      @for (toast of polite(); track toast.id) {
        <ng-container *ngTemplateOutlet="item; context: { $implicit: toast }" />
      }
    </div>
    <div class="flex flex-col gap-3" role="alert" aria-live="assertive" aria-atomic="false">
      @for (toast of assertive(); track toast.id) {
        <ng-container *ngTemplateOutlet="item; context: { $implicit: toast }" />
      }
    </div>
    </section>

    <ng-template #item let-toast>
      <div
        class="note pointer-events-auto items-center py-3 pe-3 shadow-[var(--shadow-md)]"
        [class.note-ok]="toast.kind === 'success'"
        [class.note-warn]="toast.kind === 'error'"
        [attr.data-kind]="toast.kind"
      >
        <app-icon [name]="icons[toast.kind]" />
        <p class="min-w-0 flex-1">{{ toast.message }}</p>
        <button
          type="button"
          class="border-transparent bg-transparent"
          [appIconButton]="'ui.toast.dismiss' | transloco"
          (click)="toasts.dismiss(toast.id)"
        >
          <app-icon name="x" />
        </button>
      </div>
    </ng-template>
  `,
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
  protected readonly icons = ICONS;
  protected readonly polite = computed(() => this.toasts.toasts().filter((t) => t.kind !== 'error'));
  protected readonly assertive = computed(() =>
    this.toasts.toasts().filter((t) => t.kind === 'error'),
  );
}
