import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ContentApi } from '../../../../core/api/admin/content-api';
import { Control, Field, type FieldErrorLike } from '../../../../shared/ui/field/field';
import { MarkdownEditor } from '../markdown/markdown-editor';
import type { CrudField } from './crud-config';
import { MediaField } from './media-field';

interface Input {
  field: CrudField;
  key: string;
  lang: 'ar' | 'en' | null;
}

/**
 * The inputs of a collection's form, generated from its field list: bilingual pairs side by side
 * (Arabic RTL, English LTR), Markdown with preview, selects (fixed values or another collection),
 * media pickers, checkboxes. Used by the CRUD dialog and the news editor.
 */
@Component({
  selector: 'app-crud-fields',
  imports: [TranslocoPipe, Field, Control, MarkdownEditor, MediaField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5' },
  template: `
    @for (group of groups(); track group[0].key) {
      <div class="grid gap-4" [class.md:grid-cols-2]="group.length === 2">
        @for (item of group; track item.key) {
          @switch (item.field.type) {
            @case ('markdown') {
              <app-markdown-editor
                [label]="labelOf(item)"
                [dir]="item.lang === 'en' ? 'ltr' : 'rtl'"
                [value]="str(item.key)"
                (valueChange)="set(item.key, $event)"
              />
            }
            @case ('media') {
              <app-media-field
                [label]="labelOf(item)"
                [kind]="item.field.media ?? 'image'"
                [hint]="
                  item.field.hint ? ('admin.content.hints.' + item.field.hint | transloco) : null
                "
                [value]="str(item.key)"
                (valueChange)="set(item.key, $event)"
              />
            }
            @case ('boolean') {
              <label class="check">
                <input
                  type="checkbox"
                  [checked]="!!model()[item.key]"
                  (change)="set(item.key, $any($event.target).checked)"
                />
                <span>{{ labelOf(item) }}</span>
              </label>
            }
            @default {
              <app-field
                [label]="labelOf(item)"
                [required]="!!item.field.required && item.lang !== 'en'"
                [optional]="item.lang === 'en'"
                [hint]="
                  item.field.hint ? ('admin.content.hints.' + item.field.hint | transloco) : null
                "
                [errors]="errors()[item.key] ?? []"
                [forceErrors]="true"
              >
                @switch (item.field.type) {
                  @case ('textarea') {
                    <textarea
                      appControl
                      rows="4"
                      [attr.dir]="item.lang === 'en' ? 'ltr' : item.lang === 'ar' ? 'rtl' : null"
                      [attr.maxlength]="item.field.max ?? null"
                      [value]="str(item.key)"
                      (input)="set(item.key, $any($event.target).value)"
                    ></textarea>
                  }
                  @case ('select') {
                    <select appControl (change)="set(item.key, $any($event.target).value)">
                      <option value="" [selected]="!str(item.key)">—</option>
                      @for (o of optionsOf(item.field); track o.value) {
                        <option [value]="o.value" [selected]="o.value === str(item.key)">
                          {{ o.label }}
                        </option>
                      }
                    </select>
                  }
                  @default {
                    <input
                      appControl
                      [type]="inputType(item.field)"
                      [attr.dir]="dirOf(item)"
                      [attr.inputmode]="item.field.type === 'digits' ? 'numeric' : null"
                      [attr.maxlength]="item.field.max ?? null"
                      [value]="str(item.key)"
                      (input)="set(item.key, $any($event.target).value)"
                    />
                  }
                }
              </app-field>
            }
          }
        }
      </div>
    }
  `,
})
export class CrudFields {
  readonly fields = input.required<readonly CrudField[]>();
  readonly model = model.required<Record<string, unknown>>();
  readonly errors = input<Record<string, FieldErrorLike[]>>({});
  /** Hide create-only fields (editing an existing row). */
  readonly editing = input(false);

  private readonly api = inject(ContentApi);
  private readonly t = inject(TranslocoService);
  private readonly options = signal<Record<string, { value: string; label: string }[]>>({});

  protected readonly groups = computed<Input[][]>(() =>
    this.fields()
      .filter((f) => !f.hidden && !(this.editing() && f.createOnly))
      .map((field) =>
        field.bilingual
          ? [
              { field, key: `${field.key}Ar`, lang: 'ar' as const },
              { field, key: `${field.key}En`, lang: 'en' as const },
            ]
          : [{ field, key: field.key, lang: null }],
      ),
  );

  constructor() {
    effect(() => {
      for (const f of this.fields()) {
        if (f.optionsFrom && !this.options()[f.key]) void this.loadOptions(f);
      }
    });
  }

  private async loadOptions(f: CrudField): Promise<void> {
    const source = f.optionsFrom!;
    this.options.update((o) => ({ ...o, [f.key]: [] }));
    const res = await firstValueFrom(this.api.list(source.endpoint, { limit: 100 }));
    this.options.update((o) => ({
      ...o,
      [f.key]: res.data.map((row) => ({ value: row.id, label: source.label(row) })),
    }));
  }

  protected str(key: string): string {
    const v = this.model()[key];
    return v === null || v === undefined ? '' : String(v);
  }

  protected set(key: string, value: unknown): void {
    this.model.update((m) => ({ ...m, [key]: value }));
  }

  protected labelOf(item: Input): string {
    const base = this.t.translate(`admin.content.fields.${item.field.label}`);
    return item.lang ? this.t.translate(`admin.content.lang.${item.lang}`, { label: base }) : base;
  }

  protected optionsOf(f: CrudField): { value: string; label: string }[] {
    if (f.optionsFrom) return this.options()[f.key] ?? [];
    return (f.options ?? []).map((value) => ({
      value,
      label: this.t.translate(`admin.content.options.${f.key}.${value}`),
    }));
  }

  protected inputType(f: CrudField): string {
    return f.type === 'date'
      ? 'date'
      : f.type === 'number'
        ? 'number'
        : f.type === 'url'
          ? 'url'
          : 'text';
  }

  protected dirOf(item: Input): 'rtl' | 'ltr' | null {
    if (item.lang === 'ar') return 'rtl';
    if (item.lang === 'en' || ['url', 'slug', 'digits', 'date'].includes(item.field.type))
      return 'ltr';
    return null;
  }
}

/** Client error kinds → field errors (`maxLength` carries the limit; `slug` its rule message). */
export function toFieldErrors(
  kinds: Record<string, string[]>,
  fields: readonly CrudField[],
  t: (key: string) => string,
): Record<string, FieldErrorLike[]> {
  const out: Record<string, FieldErrorLike[]> = {};
  for (const [key, list] of Object.entries(kinds)) {
    const field = fields.find((f) => key === f.key || key === `${f.key}Ar` || key === `${f.key}En`);
    out[key] = list.map((kind) =>
      kind === 'slug'
        ? { kind, message: t('admin.content.slugRule') }
        : kind === 'reserved'
          ? { kind, message: t('admin.content.slugReserved') }
          : kind === 'maxLength'
            ? ({ kind, maxLength: field?.max } as FieldErrorLike)
            : { kind },
    );
  }
  return out;
}
