import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../../core/api/admin/admin-api';
import type { AdminOverview } from '../../../core/api/models';

/**
 * Sidebar counts (`GET /admin/overview` badges: new applications for admin/reviewer, unread messages
 * for admin/support). Refreshed when the shell opens and after actions that change them.
 */
@Injectable({ providedIn: 'root' })
export class AdminBadges {
  private readonly api = inject(AdminApi);
  readonly counts = signal<AdminOverview['badges']>({});
  /** The last overview, shared with the overview page so it isn't fetched twice on first load. */
  readonly overview = signal<AdminOverview | null>(null);
  private inflight: Promise<AdminOverview | null> | null = null;

  refresh(): Promise<AdminOverview | null> {
    return (this.inflight ??= firstValueFrom(this.api.overview())
      .then((o) => {
        this.overview.set(o);
        this.counts.set(o.badges ?? {});
        return o;
      })
      .catch(() => null)
      .finally(() => (this.inflight = null)));
  }

  clear(): void {
    this.counts.set({});
    this.overview.set(null);
  }
}
