import { Directionality } from '@angular/cdk/bidi';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import type { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconButton } from '../button/button';
import { Icon } from '../icon/icon';

export type DrawerSide = 'end' | 'bottom';

/** The side the current drawer was opened on (read by `<app-drawer-frame>` for its shape). */
export const DRAWER_SIDE = new InjectionToken<DrawerSide>('DRAWER_SIDE');

export interface DrawerConfig<D = unknown> {
  /** `end`: full-height panel on the inline-end edge (left in RTL). `bottom`: bottom sheet. */
  side?: DrawerSide;
  data?: D;
  ariaLabel?: string;
  /** Id of the heading inside the drawer (`<app-drawer-frame [headingId]>`). */
  ariaLabelledBy?: string;
}

/**
 * Side drawer / bottom sheet on the CDK Dialog (focus trap, Esc, focus restore, scroll block).
 * Positioned with a direction-aware global strategy: `end('0')` resolves to the left edge in RTL.
 */
@Injectable({ providedIn: 'root' })
export class DrawerService {
  private readonly dialog = inject(Dialog);
  private readonly dir = inject(Directionality);
  private readonly injector = inject(Injector);

  open<R = unknown, D = unknown, C = unknown>(
    content: ComponentType<C> | TemplateRef<C>,
    config: DrawerConfig<D> = {},
  ): DialogRef<R, C> {
    const side = config.side ?? 'end';
    const position = createGlobalPositionStrategy(this.injector);
    return this.dialog.open<R, D, C>(content as ComponentType<C>, {
      data: config.data,
      ariaLabel: config.ariaLabel ?? null,
      ariaLabelledBy: config.ariaLabelledBy ?? null,
      direction: this.dir.value,
      positionStrategy:
        side === 'end' ? position.end('0').top('0') : position.bottom('0').centerHorizontally(),
      width: side === 'end' ? 'min(320px, 100vw)' : '100vw',
      height: side === 'end' ? '100dvh' : undefined,
      maxWidth: '100vw',
      maxHeight: side === 'end' ? '100dvh' : '85dvh',
      panelClass: side === 'end' ? 'app-drawer-panel' : 'app-sheet-panel',
      backdropClass: 'app-scrim',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      providers: [{ provide: DRAWER_SIDE, useValue: side }],
    });
  }
}

let nextId = 0;

/**
 * Drawer surface: title, close button, scrollable body and optional footer (`[drawerActions]`).
 * Square on the inline-end edge; rounded top corners as a bottom sheet.
 */
@Component({
  selector: 'app-drawer-frame',
  imports: [TranslocoPipe, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <div
      class="flex flex-col bg-card text-text shadow-[var(--shadow-md)]"
      [class]="
        side === 'bottom'
          ? 'max-h-[85dvh] rounded-t-[var(--radius-card)] border-t border-border'
          : 'h-dvh border-s border-border'
      "
    >
      @if (side === 'bottom') {
        <span
          class="mx-auto mt-3 block h-1.5 w-12 rounded-full bg-border"
          aria-hidden="true"
        ></span>
      }
      <div class="flex items-center justify-between gap-3 px-5 py-4">
        <h2 class="t-h4 min-w-0 flex-1" [id]="headingId()">{{ heading() }}</h2>
        <button
          type="button"
          [appIconButton]="closeLabel() || ('ui.drawer.close' | transloco)"
          (click)="close()"
        >
          <app-icon name="x" />
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <ng-content />
      </div>
      <div class="flex flex-wrap gap-3 border-t border-border px-5 py-4 empty:hidden">
        <ng-content select="[drawerActions]" />
      </div>
    </div>
  `,
})
export class DrawerFrame {
  private readonly dialogRef = inject(DialogRef, { optional: true });
  protected readonly side = inject(DRAWER_SIDE, { optional: true }) ?? 'end';

  readonly heading = input<string>('');
  readonly headingId = input(`app-drawer-heading-${++nextId}`);
  /** Overrides the close button's accessible name (default `ui.drawer.close`). */
  readonly closeLabel = input<string>('');
  readonly dismissed = output<void>();

  close(): void {
    this.dismissed.emit();
    this.dialogRef?.close();
  }
}
