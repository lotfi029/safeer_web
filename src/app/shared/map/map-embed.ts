/**
 * A12: the contact page's map. `GET /site` → `settings.mapEmbedUrl` is an iframe `src` that the API
 * only accepts for these two hosts, and the CSP `frame-src` (src/server/security-headers.ts) allows
 * exactly these origins. The frontend re-checks, so a value that slipped past the API never reaches an
 * iframe the CSP would block anyway.
 */
export const MAP_FRAME_ORIGINS = [
  'https://www.google.com',
  'https://www.openstreetmap.org',
] as const;

/** The embed URL when it is an https Google Maps embed or an OpenStreetMap URL; otherwise null. */
export function safeMapEmbedUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return null;
  }
  const google = url.origin === 'https://www.google.com' && url.pathname.startsWith('/maps/embed');
  const osm = url.origin === 'https://www.openstreetmap.org';
  return google || osm ? url.href : null;
}

/** "Open in maps": the pin when both coordinates are set, else the address as a search. */
export function mapSearchUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined,
): string | null {
  const query =
    typeof lat === 'number' && typeof lng === 'number' ? `${lat},${lng}` : address?.trim() || null;
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}
