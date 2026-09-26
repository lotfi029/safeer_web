import type { ImageLoaderConfig } from '@angular/common';

/** API image variants (docs/api/CONTRACT-NOTES.md "Transport"): WebP, never enlarged. */
export const IMAGE_VARIANTS = [
  { name: 'thumb', width: 400 },
  { name: 'card', width: 800 },
  { name: 'full', width: 1600 },
] as const;

export type ImageVariant = (typeof IMAGE_VARIANTS)[number]['name'];
const FILES_PREFIX = 'files/';

/** Smallest variant that covers `width`. */
export function variantFor(width: number): ImageVariant {
  return (IMAGE_VARIANTS.find((v) => v.width >= width) ?? IMAGE_VARIANTS[2]).name;
}

/**
 * srcset width descriptors (review F12): `min(specWidth, originalWidth)`, deduped. A 600px original
 * yields `400w, 600w` because the card and full variants are both 600px wide.
 */
export function srcsetWidths(originalWidth: number | null): number[] {
  const widths = IMAGE_VARIANTS.map((v) =>
    originalWidth ? Math.min(v.width, originalWidth) : v.width,
  );
  return [...new Set(widths)];
}

/**
 * NgOptimizedImage loader. `ngSrc="files/{publicId}"` → `/files/{publicId}/{variant}`; any other
 * source (e.g. `/brand/safeer-logo.png`) is returned as-is.
 */
export function filesImageLoader(config: ImageLoaderConfig): string {
  if (!config.src.startsWith(FILES_PREFIX)) {
    return config.src;
  }
  const publicId = config.src.slice(FILES_PREFIX.length);
  const variant = config.width ? variantFor(config.width) : 'card';
  return `/files/${encodeURIComponent(publicId)}/${variant}`;
}
