import { MAP_FRAME_ORIGINS, mapSearchUrl, safeMapEmbedUrl } from './map-embed';

describe('safeMapEmbedUrl (A12)', () => {
  it('accepts https Google Maps embeds and OpenStreetMap URLs', () => {
    const google = 'https://www.google.com/maps/embed?pb=!1m18';
    const osm = 'https://www.openstreetmap.org/export/embed.html?bbox=46.6,24.6,46.7,24.7';
    expect(safeMapEmbedUrl(google)).toBe(google);
    expect(safeMapEmbedUrl(osm)).toBe(osm);
  });

  it('rejects everything else', () => {
    for (const value of [
      null,
      undefined,
      '',
      'not a url',
      'http://www.google.com/maps/embed?pb=1',
      'https://www.google.com/search?q=x',
      'https://maps.google.com/maps/embed?pb=1',
      'https://www.google.com.evil.example/maps/embed',
      'https://user:pw@www.openstreetmap.org/',
      'https://www.openstreetmap.org:8443/',
      'javascript:alert(1)',
    ]) {
      expect(safeMapEmbedUrl(value)).toBeNull();
    }
  });

  it('matches the CSP frame-src origins', () => {
    expect([...MAP_FRAME_ORIGINS]).toEqual([
      'https://www.google.com',
      'https://www.openstreetmap.org',
    ]);
  });
});

describe('mapSearchUrl', () => {
  it('prefers the pin, then the address, else null', () => {
    expect(mapSearchUrl(24.65, 46.65, 'Riyadh')).toBe(
      'https://www.google.com/maps/search/?api=1&query=24.65%2C46.65',
    );
    expect(mapSearchUrl(null, 46.65, 'Riyadh')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Riyadh',
    );
    expect(mapSearchUrl(null, null, '  ')).toBeNull();
  });
});
