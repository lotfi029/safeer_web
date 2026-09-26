import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ApplicationStatus } from '../../../core/api/models';

export type PillVariant = 'teal' | 'ok' | 'warn' | 'plain' | 'solid';
export type DocumentStatus = 'under_review' | 'accepted' | 'rejected' | 'missing';

export const APPLICATION_STATUS_VARIANT: Readonly<Record<ApplicationStatus, PillVariant>> = {
  draft: 'plain',
  new: 'teal',
  under_review: 'teal',
  docs_missing: 'warn',
  interview: 'solid',
  accepted: 'ok',
  rejected: 'warn',
};

export const DOCUMENT_STATUS_VARIANT: Readonly<Record<DocumentStatus, PillVariant>> = {
  under_review: 'plain',
  accepted: 'ok',
  rejected: 'warn',
  missing: 'plain',
};

const PILL_HOST = {
  class: 'pill',
  '[class.pill-ok]': 'variant() === "ok"',
  '[class.pill-warn]': 'variant() === "warn"',
  '[class.pill-plain]': 'variant() === "plain"',
  '[class.pill-solid]': 'variant() === "solid"',
};

/** Generic pill (spec: teal default · ok · warn · plain · solid). Text is projected. */
@Component({
  selector: 'app-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: PILL_HOST,
  template: `<ng-content />`,
})
export class Pill {
  readonly variant = input<PillVariant>('teal');
}

/** Application status pill: label `status.<status>`, colour per APPLICATION_STATUS_VARIANT. */
@Component({
  selector: 'app-status-pill',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: PILL_HOST,
  template: `{{ 'status.' + status() | transloco }}`,
})
export class StatusPill {
  readonly status = input.required<ApplicationStatus>();
  protected readonly variant = computed(() => APPLICATION_STATUS_VARIANT[this.status()]);
}

/** Uploaded-document status pill: label `documentStatus.<status>`. */
@Component({
  selector: 'app-doc-status-pill',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: PILL_HOST,
  template: `{{ 'documentStatus.' + status() | transloco }}`,
})
export class DocStatusPill {
  readonly status = input.required<DocumentStatus>();
  protected readonly variant = computed(() => DOCUMENT_STATUS_VARIANT[this.status()]);
}
