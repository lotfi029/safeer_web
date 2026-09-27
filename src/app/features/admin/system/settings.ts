import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { type SiteSettings, SystemApi } from '../../../core/api/admin/system-api';
import { problemMessageKey, toApiProblem } from '../../../core/api/problem';
import { LocaleService } from '../../../core/i18n/locale.service';
import { SeoService } from '../../../core/seo/seo.service';
import { DigitsPipe } from '../../../shared/pipes/format';
import { Button } from '../../../shared/ui/button/button';
import type { FieldErrorLike } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { type CrudField, modelFromRow, toBody, validate } from '../content/crud/crud-config';
import { CrudFields, toFieldErrors } from '../content/crud/crud-fields';
import { AdminPageHead } from '../layout/admin-page-head';

/** safeer_api `MAP_EMBED_ALLOW_LIST`: exact host + path prefix, https, no port or userinfo. */
export const MAP_EMBED_ALLOW_LIST = [
  { host: 'www.google.com', pathPrefix: '/maps/embed' },
  { host: 'www.openstreetmap.org', pathPrefix: '/' },
] as const;

export function mapEmbedAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    return MAP_EMBED_ALLOW_LIST.some(
      (a) => url.hostname === a.host && url.pathname.startsWith(a.pathPrefix),
    );
  } catch {
    return false;
  }
}

const url = (key: string, label = key): CrudField => ({
  key,
  type: 'url',
  label,
  max: 255,
  nullable: true,
  hint: 'urlHint',
});

/** The settings form, section by section (safeer_api site-settings.dto.ts). */
export const SETTINGS_SECTIONS: readonly { id: string; fields: readonly CrudField[] }[] = [
  {
    id: 'org',
    fields: [
      { key: 'orgName', type: 'text', label: 'orgName', bilingual: true, required: true, max: 191 },
      { key: 'tagline', type: 'text', label: 'tagline', bilingual: true, max: 255, nullable: true },
      { key: 'phone', type: 'url', label: 'phone', max: 40, nullable: true },
      { key: 'email', type: 'url', label: 'email', max: 191, nullable: true },
      { key: 'address', type: 'text', label: 'address', bilingual: true, max: 255, nullable: true },
      {
        key: 'footerBlurb',
        type: 'textarea',
        label: 'footerBlurb',
        bilingual: true,
        nullable: true,
      },
      {
        key: 'rightsLine',
        type: 'text',
        label: 'rightsLine',
        bilingual: true,
        max: 255,
        nullable: true,
      },
    ],
  },
  {
    id: 'languages',
    fields: [{ key: 'enEnabled', type: 'boolean', label: 'enEnabled' }],
  },
  {
    id: 'seo',
    fields: [
      {
        key: 'seoTitle',
        type: 'text',
        label: 'seoTitle',
        bilingual: true,
        max: 191,
        nullable: true,
      },
      {
        key: 'seoDescription',
        type: 'textarea',
        label: 'seoDescription',
        bilingual: true,
        max: 500,
        nullable: true,
      },
    ],
  },
  {
    id: 'social',
    fields: [
      url('facebookUrl'),
      url('instagramUrl'),
      url('xUrl'),
      url('youtubeUrl'),
      url('linkedinUrl'),
      url('whatsappUrl'),
      url('tiktokUrl'),
    ],
  },
  {
    id: 'map',
    fields: [
      {
        key: 'mapEmbedUrl',
        type: 'url',
        label: 'mapEmbedUrl',
        max: 500,
        nullable: true,
        hint: 'mapEmbedHint',
      },
      { key: 'mapLat', type: 'number', label: 'mapLat', nullable: true },
      { key: 'mapLng', type: 'number', label: 'mapLng', nullable: true },
    ],
  },
  {
    id: 'applications',
    fields: [
      {
        key: 'applicationRefPrefix',
        type: 'text',
        label: 'applicationRefPrefix',
        required: true,
        max: 10,
        hint: 'prefixHint',
      },
      { key: 'notifyEmailOnStatusChange', type: 'boolean', label: 'notifyEmail' },
      { key: 'notifySmsOnStatusChange', type: 'boolean', label: 'notifySms' },
    ],
  },
];

const ALL_FIELDS = SETTINGS_SECTIONS.flatMap((s) => s.fields);

/** Rules the generic checks don't cover (map host allow-list, coordinates, prefix, http(s) links). */
export function settingsErrors(model: Record<string, unknown>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const add = (k: string, kind: string) => (errors[k] ??= []).push(kind);
  const map = String(model['mapEmbedUrl'] ?? '').trim();
  if (map && !mapEmbedAllowed(map)) add('mapEmbedUrl', 'mapHost');
  const lat = String(model['mapLat'] ?? '');
  if (lat !== '' && !(Number(lat) >= -90 && Number(lat) <= 90)) add('mapLat', 'range');
  const lng = String(model['mapLng'] ?? '');
  if (lng !== '' && !(Number(lng) >= -180 && Number(lng) <= 180)) add('mapLng', 'range');
  const prefix = String(model['applicationRefPrefix'] ?? '').trim();
  if (prefix && !/^[A-Z]+$/.test(prefix)) add('applicationRefPrefix', 'prefix');
  for (const f of SETTINGS_SECTIONS.find((s) => s.id === 'social')!.fields) {
    const v = String(model[f.key] ?? '').trim();
    if (v && !/^(https?:\/\/[^/\s]+|mailto:|tel:)\S*$/i.test(v)) add(f.key, 'url');
  }
  const email = String(model['email'] ?? '').trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) add('email', 'email');
  return errors;
}

/**
 * Site settings (prototype `aSettings`, `PUT admin/settings`): organisation details, languages, SEO,
 * social links, the map (Google Maps embed or OpenStreetMap only, like the API's allow-list),
 * application reference prefix and status notifications; plus the API cache.
 */
@Component({
  selector: 'app-admin-settings',
  imports: [TranslocoPipe, DigitsPipe, Button, Icon, AdminPageHead, CrudFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <app-admin-page-head [heading]="'admin.system.settings.title' | transloco" />
    @if (settings.error()) {
      <p class="note note-warn" role="alert">{{ 'admin.common.loadError' | transloco }}</p>
    } @else if (ready()) {
      <div class="grid gap-6 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          class="hidden xl:block"
          [attr.aria-label]="'admin.system.settings.sections' | transloco"
        >
          <ul class="sticky top-24 m-0 flex list-none flex-col gap-1 p-0">
            @for (s of sections; track s.id) {
              <li>
                <a
                  class="block rounded-btn px-3 py-2.5 font-semibold text-text no-underline hover:bg-raise"
                  [href]="'#settings-' + s.id"
                  >{{ 'admin.system.settings.section.' + s.id | transloco }}</a
                >
              </li>
            }
            <li>
              <a
                class="block rounded-btn px-3 py-2.5 font-semibold text-text no-underline hover:bg-raise"
                href="#settings-cache"
                >{{ 'admin.system.settings.section.cache' | transloco }}</a
              >
            </li>
          </ul>
        </nav>
        <form
          class="flex min-w-0 flex-col gap-6"
          novalidate
          (submit)="save($event)"
          id="settings-form"
        >
          @for (s of sections; track s.id) {
            <section
              class="card flex scroll-mt-24 flex-col gap-5"
              [id]="'settings-' + s.id"
              [attr.aria-labelledby]="'settings-' + s.id + '-title'"
            >
              <h2 class="t-h4 m-0 text-heading" [id]="'settings-' + s.id + '-title'">
                {{ 'admin.system.settings.section.' + s.id | transloco }}
              </h2>
              @if (s.id === 'languages') {
                <p class="t-small m-0 text-text-muted">
                  {{ 'admin.system.settings.languagesLead' | transloco }}
                </p>
              }
              <app-crud-fields [fields]="s.fields" [(model)]="model" [errors]="errors()" />
            </section>
          }
          @if (errorKey(); as key) {
            <p class="note note-warn m-0" role="alert">{{ key | transloco }}</p>
          }
          <div
            class="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-3 border-t border-border bg-app-bg px-4 py-3 md:mx-0 md:rounded-card md:border md:bg-card"
          >
            <button appButton type="submit" [busy]="busy()" [disabled]="busy() || !dirty()">
              {{ 'admin.system.settings.save' | transloco }}
            </button>
            <button
              appButton
              variant="ghost"
              type="button"
              [disabled]="busy() || !dirty()"
              (click)="reset()"
            >
              {{ 'admin.system.settings.discard' | transloco }}
            </button>
          </div>
        </form>
      </div>

      <section
        class="card mt-6 flex scroll-mt-24 flex-col gap-4 xl:ms-[15.5rem]"
        id="settings-cache"
        aria-labelledby="cache-title"
      >
        <h2 class="t-h4 m-0 text-heading" id="cache-title">
          {{ 'admin.system.settings.section.cache' | transloco }}
        </h2>
        <p class="t-small m-0 text-text-muted">
          {{ 'admin.system.settings.cacheLead' | transloco }}
        </p>
        @if (cache.value(); as c) {
          <p class="m-0" data-testid="cache-stats">
            {{
              'admin.system.settings.cacheStats'
                | transloco
                  : {
                      entries: (c.entries | digits),
                      max: (c.maxEntries | digits),
                      rate: (percent(c.hitRate) | digits),
                    }
            }}
          </p>
        }
        <button
          appButton
          variant="line"
          type="button"
          class="self-start"
          [disabled]="busy()"
          (click)="purge()"
        >
          <app-icon name="refresh-cw" [size]="16" />{{ 'admin.system.settings.purge' | transloco }}
        </button>
      </section>
    } @else {
      <span class="skeleton block h-80" aria-hidden="true"></span>
    }
  `,
})
export class AdminSettings {
  private readonly api = inject(SystemApi);
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  protected readonly sections = SETTINGS_SECTIONS;
  protected readonly settings = rxResource({ stream: () => this.api.settings() });
  protected readonly cache = rxResource({ stream: () => this.api.cacheStats() });
  protected readonly model = signal<Record<string, unknown>>({});
  private readonly loaded = signal<Record<string, unknown>>({});
  protected readonly busy = signal(false);
  protected readonly tried = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly server = signal<Record<string, string[]>>({});
  protected readonly ready = computed(() => Object.keys(this.loaded()).length > 0);
  protected readonly dirty = computed(
    () => JSON.stringify(this.model()) !== JSON.stringify(this.loaded()),
  );
  private readonly client = computed(() => {
    const own = settingsErrors(this.model());
    const generic = validate(ALL_FIELDS, this.model());
    const merged: Record<string, string[]> = { ...generic };
    for (const [k, v] of Object.entries(own)) merged[k] = [...(merged[k] ?? []), ...v];
    return merged;
  });
  protected readonly errors = computed<Record<string, FieldErrorLike[]>>(() => {
    const out: Record<string, FieldErrorLike[]> = {};
    if (this.tried()) {
      for (const [key, kinds] of Object.entries(this.client())) {
        out[key] = kinds.map((kind) =>
          ['mapHost', 'range', 'prefix', 'url'].includes(kind)
            ? { kind, message: this.t.translate(`admin.system.settings.errors.${kind}`) }
            : toFieldErrors({ [key]: [kind] }, ALL_FIELDS, (k) => this.t.translate(k))[key][0],
        );
      }
    }
    for (const [key, messages] of Object.entries(this.server())) {
      out[key] = [...(out[key] ?? []), ...messages.map((message) => ({ kind: 'server', message }))];
    }
    return out;
  });

  constructor() {
    inject(SeoService).noindex('Admin', this.locale.lang());
    // Adopt the settings once they load (saves adopt the API's answer themselves).
    let adopted = false;
    effect(() => {
      const s = this.settings.value();
      if (s && !adopted) {
        adopted = true;
        untracked(() => this.adopt(s));
      }
    });
  }

  protected percent(rate: number): string {
    return String(Math.round(rate * 100));
  }

  private adopt(s: SiteSettings): void {
    const m = modelFromRow(ALL_FIELDS, { ...s, id: s.id } as never);
    this.loaded.set(m);
    this.model.set({ ...m });
  }

  protected reset(): void {
    this.model.set({ ...this.loaded() });
    this.tried.set(false);
    this.server.set({});
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    this.errorKey.set(null);
    this.server.set({});
    if (Object.keys(this.client()).length) return;
    const all = toBody(ALL_FIELDS, this.model(), 'update');
    const before = toBody(ALL_FIELDS, this.loaded(), 'update');
    // PUT takes a partial: send only what changed.
    const body = Object.fromEntries(
      Object.entries(all).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k])),
    );
    this.busy.set(true);
    try {
      this.adopt(await firstValueFrom(this.api.saveSettings(body)));
      this.tried.set(false);
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.system.settings.saved'),
      });
    } catch (error) {
      const problem = toApiProblem(error);
      this.server.set(problem.fieldErrors);
      this.errorKey.set(problemMessageKey(problem));
    } finally {
      this.busy.set(false);
    }
  }

  protected async purge(): Promise<void> {
    this.busy.set(true);
    try {
      const { purged } = await firstValueFrom(this.api.purgeCache());
      this.toasts.show({
        kind: 'success',
        message: this.t.translate('admin.system.settings.purged', { count: purged }),
      });
      this.cache.reload();
    } catch (error) {
      this.toasts.show({
        kind: 'error',
        message: this.t.translate(problemMessageKey(toApiProblem(error))),
      });
    } finally {
      this.busy.set(false);
    }
  }
}
