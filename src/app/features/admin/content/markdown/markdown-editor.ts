import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { IconName } from '../../../../shared/ui/icon/icon-names';
import { RichText } from '../../../../shared/ui/rich-text/rich-text';
import { renderMarkdown } from './render-markdown';

interface Tool {
  key: string;
  icon: IconName;
  before: string;
  after?: string;
  /** Line-level (prefix each selected line). */
  line?: boolean;
}

const TOOLS: readonly Tool[] = [
  { key: 'h2', icon: 'heading-2', before: '## ', line: true },
  { key: 'h3', icon: 'heading-3', before: '### ', line: true },
  { key: 'bold', icon: 'bold', before: '**', after: '**' },
  { key: 'italic', icon: 'italic', before: '_', after: '_' },
  { key: 'list', icon: 'list', before: '- ', line: true },
  { key: 'ordered', icon: 'list-ordered', before: '1. ', line: true },
  { key: 'quote', icon: 'quote', before: '> ', line: true },
  { key: 'link', icon: 'link-2', before: '[', after: '](https://)' },
];

/** Applies a toolbar action to `text` between `start` and `end`; returns the new text and selection. */
export function applyTool(
  text: string,
  start: number,
  end: number,
  tool: Pick<Tool, 'before' | 'after' | 'line'>,
): { text: string; start: number; end: number } {
  if (tool.line) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const block = text.slice(lineStart, end);
    const prefixed = block
      .split('\n')
      .map((l) => tool.before + l)
      .join('\n');
    return {
      text: text.slice(0, lineStart) + prefixed + text.slice(end),
      start: lineStart,
      end: lineStart + prefixed.length,
    };
  }
  const after = tool.after ?? '';
  const selected = text.slice(start, end);
  return {
    text: text.slice(0, start) + tool.before + selected + after + text.slice(end),
    start: start + tool.before.length,
    end: start + tool.before.length + selected.length,
  };
}

/**
 * Markdown field: a toolbar for the syntax the API keeps (h2–h4, bold, italic, lists, quote, link),
 * a write/preview switch, and the preview rendered with the API's rules.
 */
@Component({
  selector: 'app-markdown-editor',
  imports: [TranslocoPipe, Icon, RichText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="field-label" [id]="labelId">{{ label() }}</span>
      <div class="flex gap-1" role="group" [attr.aria-label]="label()">
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="!preview()"
          (click)="preview.set(false)"
        >
          {{ 'admin.content.markdown.write' | transloco }}
        </button>
        <button
          type="button"
          class="chip"
          [attr.aria-pressed]="preview()"
          (click)="preview.set(true)"
        >
          {{ 'admin.content.markdown.preview' | transloco }}
        </button>
      </div>
    </div>
    @if (preview()) {
      <div
        class="min-h-40 rounded-btn border border-border bg-card p-4"
        [attr.dir]="dir()"
        data-testid="markdown-preview"
      >
        @if (html()) {
          <app-rich-text [html]="html()" />
        } @else {
          <p class="t-muted m-0">{{ 'admin.content.markdown.empty' | transloco }}</p>
        }
      </div>
    } @else {
      <div
        class="flex flex-wrap gap-1"
        role="toolbar"
        [attr.aria-label]="'admin.content.markdown.toolbar' | transloco"
      >
        @for (tool of tools; track tool.key) {
          <button
            type="button"
            class="icon-btn size-11"
            [attr.aria-label]="'admin.content.markdown.' + tool.key | transloco"
            [attr.title]="'admin.content.markdown.' + tool.key | transloco"
            (click)="apply(tool)"
          >
            <app-icon [name]="tool.icon" [size]="18" [directional]="false" />
          </button>
        }
      </div>
      <textarea
        #area
        class="control min-h-48 font-mono text-sm"
        [attr.aria-labelledby]="labelId"
        [attr.dir]="dir()"
        [attr.rows]="rows()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
      ></textarea>
      <p class="field-hint m-0">{{ 'admin.content.markdown.hint' | transloco }}</p>
    }
  `,
})
export class MarkdownEditor {
  readonly value = model('');
  readonly label = input.required<string>();
  readonly dir = input<'rtl' | 'ltr'>('rtl');
  readonly rows = input(10);

  private readonly doc = inject(DOCUMENT);
  private readonly area = viewChild<ElementRef<HTMLTextAreaElement>>('area');
  protected readonly tools = TOOLS;
  protected readonly preview = signal(false);
  protected readonly labelId = `md-label-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly html = computed(() =>
    this.preview() ? renderMarkdown(this.value(), this.doc) : '',
  );

  protected apply(tool: Tool): void {
    const el = this.area()?.nativeElement;
    const text = this.value();
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = applyTool(text, start, end, tool);
    this.value.set(next.text);
    queueMicrotask(() => {
      el?.focus();
      el?.setSelectionRange(next.start, next.end);
    });
  }
}
