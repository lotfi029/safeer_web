import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, required, email, minLength } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Asset } from '../../../core/api/models';
import { DigitsPipe, FileSizePipe, LocalDatePipe, RelTimePipe } from '../../../shared/pipes/format';
import { Button, IconButton } from '../../../shared/ui/button/button';
import { Control, Field } from '../../../shared/ui/field/field';
import { Icon } from '../../../shared/ui/icon/icon';
import { ICON_NAMES } from '../../../shared/ui/icon/icon-names';
import { Image } from '../../../shared/ui/image/image';

/** Kit: tokens, typography, buttons, icons, fields, images, pipes. */
@Component({
  selector: 'app-kit-basics-section',
  imports: [
    TranslocoPipe,
    FormField,
    Button,
    IconButton,
    Control,
    Field,
    Icon,
    Image,
    DigitsPipe,
    FileSizePipe,
    LocalDatePipe,
    RelTimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="kit-tokens" class="flex flex-col gap-4">
      <h2 id="kit-tokens" class="t-h4">Tokens</h2>
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        @for (t of tokens; track t) {
          <li class="flex flex-col gap-1">
            <span
              class="block h-12 rounded-tile border border-border"
              [style.background]="'var(' + t + ')'"
            ></span>
            <code class="t-caption" dir="ltr">{{ t }}</code>
          </li>
        }
      </ul>
    </section>

    <section aria-labelledby="kit-type" class="flex flex-col gap-3">
      <h2 id="kit-type" class="t-h4">Typography</h2>
      <p class="t-display">Display · جمعية سفير الدعوية</p>
      <p class="t-h1">H1 · جمعية سفير الدعوية</p>
      <p class="t-h2">H2 · جمعية سفير الدعوية</p>
      <p class="t-h3">H3 · جمعية سفير الدعوية</p>
      <p class="t-h4">H4 · جمعية سفير الدعوية</p>
      <p class="t-eyebrow">Eyebrow · [...]</p>
      <p class="t-lead">Lead · [...]</p>
      <p>Body 17/1.85 · [...]</p>
      <p class="t-small">Small 14 · [...]</p>
      <p class="t-caption">Caption 13 · [...]</p>
      <p>
        Phone: <bdi class="ltr">+966 53 464 6648</bdi> · Ref: <bdi class="ltr">SA-2026-00001</bdi>
      </p>
    </section>

    <section aria-labelledby="kit-buttons" class="flex flex-col gap-4">
      <h2 id="kit-buttons" class="t-h4">Buttons</h2>
      <div class="flex flex-wrap gap-3">
        <button appButton type="button">Primary</button>
        <button appButton variant="ghost" type="button">Ghost</button>
        <button appButton variant="soft" type="button">Soft</button>
        <button appButton variant="line" type="button">Line</button>
        <button appButton variant="danger" type="button">Danger</button>
        <button appButton variant="link" type="button">Link</button>
        <button appButton size="sm" type="button">Small</button>
        <button appButton type="button" disabled>Disabled</button>
        <button appButton type="button" [busy]="true" disabled>
          {{ 'common.loading' | transloco }}
        </button>
        <a appButton href="#kit-buttons"> Anchor <app-icon name="arrow-left" [size]="18" /> </a>
        <button type="button" [appIconButton]="'common.close' | transloco">
          <app-icon name="x" />
        </button>
      </div>
      <div class="band flex flex-wrap gap-3 rounded-card p-6">
        <button appButton variant="onband" type="button">On band</button>
        <button appButton variant="onband-ghost" type="button">On band ghost</button>
      </div>
    </section>

    <section aria-labelledby="kit-icons" class="flex flex-col gap-4">
      <h2 id="kit-icons" class="t-h4">Icons ({{ icons.length }})</h2>
      <ul class="grid grid-cols-4 gap-3 sm:grid-cols-8 lg:grid-cols-12">
        @for (name of icons; track name) {
          <li class="flex flex-col items-center gap-1 text-secondary">
            <app-icon [name]="name" [size]="24" />
            <code class="t-caption text-center break-all" dir="ltr">{{ name }}</code>
          </li>
        }
      </ul>
    </section>

    <section aria-labelledby="kit-fields" class="flex flex-col gap-4">
      <h2 id="kit-fields" class="t-h4">Fields (Signal Forms)</h2>
      <form class="grid gap-5 md:grid-cols-2" novalidate>
        <app-field label="Email" [state]="demo.email()" hint="[...]">
          <input appControl type="email" dir="ltr" autocomplete="email" [formField]="demo.email" />
        </app-field>
        <app-field label="Name" [state]="demo.name()" [forceErrors]="true">
          <input appControl type="text" autocomplete="name" [formField]="demo.name" />
        </app-field>
        <app-field label="Select" [optional]="true">
          <select appControl>
            <option value="">[...]</option>
            <option value="a">[...] A</option>
          </select>
        </app-field>
        <app-field label="Disabled">
          <input appControl type="text" disabled value="[...]" />
        </app-field>
        <app-field
          label="Message"
          [errors]="[{ kind: 'server', message: 'Server error example' }]"
          class="md:col-span-2"
        >
          <textarea appControl></textarea>
        </app-field>
      </form>
    </section>

    <section aria-labelledby="kit-images" class="flex flex-col gap-4">
      <h2 id="kit-images" class="t-h4">Images</h2>
      <div class="grid gap-4 md:grid-cols-3">
        <app-image
          [asset]="asset"
          sizes="(min-width: 768px) 33vw, 100vw"
          imgClass="rounded-card w-full h-auto"
        />
        <app-image placeholder="طلاب في فعالية" [aspect]="[4, 3]" imgClass="w-full" />
        <app-image placeholder="شعار شريك" [aspect]="[1, 1]" imgClass="w-full" />
      </div>
    </section>

    <section aria-labelledby="kit-pipes" class="flex flex-col gap-2">
      <h2 id="kit-pipes" class="t-h4">Pipes</h2>
      <p>digits: {{ 2026 | digits }}</p>
      <p>fileSize: {{ 2516582 | fileSize }}</p>
      <p>localDate: {{ '2020-07-30' | localDate }}</p>
      <p>relTime: {{ '2026-09-20T10:00:00Z' | relTime: now }}</p>
    </section>
  `,
  host: { class: 'flex flex-col gap-12' },
})
export class KitBasicsSection {
  protected readonly tokens = [
    '--primary',
    '--primary-dark',
    '--secondary',
    '--secondary-light',
    '--surface',
    '--bg',
    '--card',
    '--raise',
    '--text',
    '--text-muted',
    '--muted-decor',
    '--border',
    '--alert',
    '--alert-bg',
    '--success',
    '--success-bg',
    '--band',
    '--band-card',
  ];
  protected readonly icons = ICON_NAMES;
  protected readonly now = new Date('2026-09-26T10:00:00Z');
  protected readonly asset: Asset = {
    id: 'demo',
    publicId: 'demo',
    kind: 'image',
    mimeType: 'image/webp',
    sizeBytes: 1,
    widthPx: 1200,
    heightPx: 800,
    alt: '',
  };
  private readonly model = signal({ email: 'not-an-email', name: '' });
  protected readonly demo = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.name);
    minLength(p.name, 2);
  });
}
