import { subscriberStatus } from '../../../core/api/admin/system-api';
import { COLLECTIONS } from '../content/crud/collections';
import {
  type CrudField,
  fromRiyadhInput,
  toBody,
  toRiyadhInput,
  validate,
} from '../content/crud/crud-config';
import { deviceLabel } from './account';
import { diffLines } from './audit';
import { templateFields, unknownVariables } from './channel';
import { mapEmbedAllowed, settingsErrors } from './settings';

describe('settings rules (site-settings.dto.ts)', () => {
  it('accepts only the map embed allow-list, exactly', () => {
    expect(mapEmbedAllowed('https://www.google.com/maps/embed?pb=1')).toBe(true);
    expect(mapEmbedAllowed('https://www.openstreetmap.org/export/embed.html?bbox=1')).toBe(true);
    expect(mapEmbedAllowed('https://maps.google.com/maps/embed?pb=1')).toBe(false);
    expect(mapEmbedAllowed('https://openstreetmap.org/x')).toBe(false);
    expect(mapEmbedAllowed('http://www.openstreetmap.org/x')).toBe(false);
    expect(mapEmbedAllowed('https://www.google.com:8443/maps/embed')).toBe(false);
    expect(mapEmbedAllowed('https://www.google.com/maps/place')).toBe(false);
  });

  it('checks coordinates and social links', () => {
    expect(
      settingsErrors({
        mapLat: '91',
        mapLng: '-181',
        facebookUrl: 'javascript:x',
      }),
    ).toEqual({
      mapLat: ['range'],
      mapLng: ['range'],
      facebookUrl: ['url'],
    });
    expect(
      settingsErrors({
        mapLat: '24.7',
        facebookUrl: 'https://facebook.com/x',
      }),
    ).toEqual({});
  });
});

describe('mail templates', () => {
  it('finds placeholders the template does not declare', () => {
    expect(unknownVariables(['Hi {{ name }}, {{link}} {{ other }}'], ['name', 'link'])).toEqual([
      'other',
    ]);
    expect(unknownVariables([null, 'plain'], [])).toEqual([]);
  });

  it('mail templates have a subject and a body', () => {
    expect(templateFields().map((f) => f.key)).toEqual(['name', 'subject', 'body', 'isEnabled']);
  });
});

describe('governance collections (licences, document sections)', () => {
  it('licences: dates stay plain, empties are null, isPrimary is a boolean, PATCH :id/primary', () => {
    const l = COLLECTIONS['licences'];
    expect(
      toBody(
        l.fields,
        {
          titleAr: 'ترخيص',
          titleEn: '',
          number: '',
          issuerAr: '',
          issuerEn: '',
          issuedOn: '2020-01-01',
          expiresOn: '',
          assetId: '',
          isPrimary: true,
        },
        'update',
      ),
    ).toEqual({
      titleAr: 'ترخيص',
      titleEn: null,
      number: null,
      issuerAr: null,
      issuerEn: null,
      issuedOn: '2020-01-01',
      expiresOn: null,
      assetId: null,
      isPrimary: true,
    });
    expect(l.flag).toMatchObject({ key: 'isPrimary', path: 'primary' });
    expect(l.publish).toBe('route');
    expect(l.sortable).toBe(true);
  });

  it('document categories default to the governance group; documents carry a meta line', () => {
    const c = COLLECTIONS['docCategories'];
    expect(c.fields.find((f) => f.key === 'sectionGroup')).toMatchObject({
      options: ['governance', 'other'],
      defaultValue: 'governance',
    });
    expect(
      toBody(
        COLLECTIONS['documents'].fields.filter((f) => f.key === 'meta'),
        { metaAr: ' ٢٠٢٤ ', metaEn: '' },
        'create',
      ),
    ).toEqual({ metaAr: '٢٠٢٤', metaEn: null });
  });
});

describe('datetime fields and redirects', () => {
  const fields: CrudField[] = [
    { key: 'startsAt', type: 'datetime', label: 'startsAt', required: true },
    { key: 'endsAt', type: 'datetime', label: 'endsAt', required: true, after: 'startsAt' },
    { key: 'location', type: 'text', label: 'location', bilingual: true, nullable: true },
  ];

  it('converts Riyadh wall-clock time to an ISO instant with offset and back', () => {
    expect(fromRiyadhInput('2026-10-12T10:00')).toBe('2026-10-12T10:00:00+03:00');
    expect(toRiyadhInput('2026-10-12T07:00:00.000Z')).toBe('2026-10-12T10:00');
  });

  it('requires the end after the start and sends ISO instants', () => {
    expect(validate(fields, { startsAt: '2026-10-12T10:00', endsAt: '2026-10-12T09:00' })).toEqual({
      endsAt: ['after'],
    });
    expect(
      toBody(
        fields,
        {
          startsAt: '2026-10-12T10:00',
          endsAt: '2026-10-12T10:30',
          locationAr: '',
          locationEn: '',
        },
        'create',
      ),
    ).toEqual({
      startsAt: '2026-10-12T10:00:00+03:00',
      endsAt: '2026-10-12T10:30:00+03:00',
      locationAr: null,
      locationEn: null,
    });
  });

  it('sends the redirect type as a number and puts REDIRECT_CHAIN next to the right field', () => {
    const r = COLLECTIONS['redirects'];
    expect(toBody(r.fields, { fromPath: '/a', toPath: '/b', statusCode: '302' }, 'create')).toEqual(
      {
        fromPath: '/a',
        toPath: '/b',
        statusCode: 302,
      },
    );
    expect(r.errorField?.('REDIRECT_CHAIN', 'A redirect from /a already exists')).toBe('fromPath');
    expect(r.errorField?.('REDIRECT_CHAIN', 'Redirects must not chain')).toBe('toPath');
    expect(r.errorField?.('CONFLICT', '')).toBeNull();
    expect(r.deleteArea).toBe('redirects.delete');
  });
});

describe('audit, newsletter, account helpers', () => {
  it('lists only the fields that changed', () => {
    expect(
      diffLines({
        before: { a: 1, b: 'x', updatedAt: '1' },
        after: { a: 2, b: 'x', updatedAt: '2' },
      }),
    ).toEqual([{ key: 'a', before: '1', after: '2' }]);
    expect(diffLines({ before: null, after: { anonymized: true } })).toEqual([
      { key: 'anonymized', before: '—', after: 'true' },
    ]);
    expect(diffLines(null)).toEqual([]);
  });

  it('derives the subscriber status (double opt-in)', () => {
    expect(subscriberStatus({ confirmedAt: null, unsubscribedAt: null })).toBe('pending');
    expect(subscriberStatus({ confirmedAt: 'x', unsubscribedAt: null })).toBe('subscribed');
    expect(subscriberStatus({ confirmedAt: 'x', unsubscribedAt: 'y' })).toBe('unsubscribed');
  });

  it('names a device from its user agent', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toBe('Chrome · Windows');
    expect(deviceLabel(null)).toBe('—');
  });
});
