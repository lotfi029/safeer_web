import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ContentApi, type MediaAsset } from '../../../../core/api/admin/content-api';
import type { Id } from '../../../../core/api/models';

/**
 * The media library, cached for the dashboard session. Content rows only carry asset ids
 * (`coverAssetId`, `photoAssetId`, …); the list maps them to `publicId`, kind and alt text.
 */
@Injectable({ providedIn: 'root' })
export class MediaStore {
  private readonly api = inject(ContentApi);
  readonly assets = signal<MediaAsset[]>([]);
  readonly loaded = signal(false);
  readonly byId = computed(() => new Map(this.assets().map((a) => [a.id, a])));
  private inflight: Promise<void> | null = null;

  ensure(): Promise<void> {
    if (this.loaded()) return Promise.resolve();
    return (this.inflight ??= this.load().finally(() => (this.inflight = null)));
  }

  async load(): Promise<void> {
    const all: MediaAsset[] = [];
    for (let page = 1; page <= 20; page++) {
      const res = await firstValueFrom(this.api.media({ page, limit: 100 }));
      all.push(...res.data);
      if (all.length >= res.total || !res.data.length) break;
    }
    this.assets.set(all);
    this.loaded.set(true);
  }

  get(id: Id | null | undefined): MediaAsset | undefined {
    return id ? this.byId().get(String(id)) : undefined;
  }

  upsert(asset: MediaAsset): void {
    this.assets.update((list) => [asset, ...list.filter((a) => a.id !== asset.id)]);
  }

  drop(id: Id): void {
    this.assets.update((list) => list.filter((a) => a.id !== id));
  }
}
