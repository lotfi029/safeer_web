import { NgTemplateOutlet } from '@angular/common';
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
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { OrgNode } from '../../../core/api/models';
import { type ChartRow, type ChartSlot, stackLeaves } from './org-chart.layout';

let nextId = 0;

/** The layouts map's key for the top-level row (every other row is keyed by its parent's id). */
const ROOTS = '';

/** Below this the box text drops under ~11px — the chart switches to the vertical tree instead. */
const MIN_SCALE = 0.72;
/** The container width under which the CSS already draws the vertical tree (org-chart.css). */
const LIST_BREAKPOINT = 700;

/**
 * The organisational structure, ported from ta3lom's org chart (CR-01 FE-5). Presentational: it
 * takes the `GET /org-chart` forest (names already in the page language) or the dashboard's
 * client-side preview, and makes no HTTP call.
 *
 * Real structure for assistive tech, not a picture: nested `<ul>`/`<li>`, one box per position,
 * each nested list labelled "under <position>", and a visually hidden caption. Connectors are
 * pseudo-elements drawn with logical properties only, so the tree mirrors by itself: in Arabic the
 * first child sits on the right.
 *
 * It never scrolls sideways once measured. Layout is by CONTAINER width, so the dashboard preview
 * (a narrow column) behaves like the public page at that width:
 *   ≥ 700px  the horizontal tree, scaled down to fit when wider than its column; if that needs a
 *            scale under MIN_SCALE, the stacked tree (org-chart.layout.ts), and if that is still too
 *            wide, the vertical tree;
 *   < 700px  the vertical indented tree — nothing scrolls at 320px.
 * The server-rendered HTML may scroll a wide tree until the browser has measured it.
 */
@Component({
  selector: 'app-org-chart',
  imports: [NgTemplateOutlet, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './org-chart.html',
  styleUrl: './org-chart.css',
})
export class OrgChart {
  readonly nodes = input.required<readonly OrgNode[]>();

  protected readonly captionId = `org-chart-caption-${nextId++}`;
  protected readonly empty = computed(() => this.nodes().length === 0);

  /** Set once the browser has measured — until then the server-rendered CSS fallback applies. */
  protected readonly fitted = signal(false);
  /**
   * How the wide (≥ 700px) layout fits its column, tried in order until one fits at ≥ MIN_SCALE:
   *   0 — the full horizontal tree;
   *   1 — stacked: still root → children, but consecutive sibling leaves share one column;
   *   2 — the vertical indented tree (as on phones).
   */
  protected readonly level = signal<0 | 1 | 2>(0);
  protected readonly stacked = computed(() => this.level() === 1);
  protected readonly asList = computed(() => this.level() === 2);
  protected readonly scale = signal(1);
  /** Negative block margin that removes the empty space a scaled-down tree leaves under itself. */
  protected readonly collapse = signal(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly forest = viewChild<ElementRef<HTMLElement>>('forest');
  /** Natural width of levels 0 and 1, when last drawn wider than their column (0 = unknown). */
  private natural: [number, number] = [0, 0];
  private frame = 0;

  constructor() {
    // New content (the dashboard preview edits it live) may fit where the old did not: start again
    // from the full tree and let the next measurement decide.
    effect(() => {
      this.nodes();
      this.natural = [0, 0];
      this.level.set(0);
      this.schedule();
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.schedule());
      observer.observe(this.host.nativeElement);
      const forest = this.forest()?.nativeElement;
      if (forest) observer.observe(forest);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        cancelAnimationFrame(this.frame);
      });
    });
  }

  /** One measurement per frame, outside the ResizeObserver callback (no observer loop). */
  private schedule(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.measure());
  }

  private measure(): void {
    const forest = this.forest()?.nativeElement;
    if (!this.scroller() || !forest) return;

    const available = this.host.nativeElement.clientWidth;
    this.fitted.set(true);

    // Narrow column: the CSS already draws the vertical tree, which always fits.
    if (available < LIST_BREAKPOINT) {
      this.reset();
      return;
    }

    // Skip the layouts already known to be too wide for this column; try the rest.
    let next = 0;
    while (next < 2 && this.natural[next] && available < this.natural[next]! * MIN_SCALE) next++;
    const target = next as 0 | 1 | 2;
    if (target !== this.level()) {
      this.reset();
      this.level.set(target);
      this.schedule();
      return;
    }
    if (target === 2) {
      this.reset();
      return;
    }

    // `.forest` is `max-content` wide with a 100% minimum: its layout width is the tree's own
    // width whenever that exceeds the column. A transform never changes it.
    const width = forest.offsetWidth;
    this.natural[target] = width > available ? width : 0;
    const scale = Math.min(1, available / width);

    if (scale < MIN_SCALE) {
      this.reset();
      this.level.set((target + 1) as 1 | 2);
      this.schedule();
      return;
    }
    this.scale.set(scale);
    this.collapse.set(scale < 1 ? -(1 - scale) * forest.offsetHeight : 0);
  }

  private reset(): void {
    this.scale.set(1);
    this.collapse.set(0);
  }

  /** Every sibling row's stacked placement, by parent id. Only read under `.stacked`. */
  private readonly layouts = computed(() => {
    const map = new Map<string, ChartRow>();
    const visit = (key: string, nodes: readonly OrgNode[]): void => {
      map.set(key, stackLeaves(nodes));
      for (const node of nodes) if (node.children.length > 0) visit(String(node.id), node.children);
    };
    visit(ROOTS, this.nodes());
    return map;
  });

  protected readonly rootKey = ROOTS;

  protected rows(key: string): number {
    return this.layouts().get(key)?.rows ?? 1;
  }

  protected slot(key: string, index: number): ChartSlot | undefined {
    return this.layouts().get(key)?.slots[index];
  }

  protected idOf(node: OrgNode): string {
    return String(node.id);
  }
}
