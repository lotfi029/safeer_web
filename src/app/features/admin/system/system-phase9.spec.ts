import { subscriberStatus } from '../../../core/api/admin/system-api';
import { COLLECTIONS, slotLabel } from '../content/crud/collections';
import { fromRiyadhInput, toBody, toRiyadhInput, validate } from '../content/crud/crud-config';
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

  it('checks coordinates, the reference prefix and social links', () => {
    expect(
      settingsErrors({
        mapLat: '91',
        mapLng: '-181',
        applicationRefPrefix: 'sa',
        facebookUrl: 'javascript:x',
      }),
    ).toEqual({
      mapLat: ['range'],
      mapLng: ['range'],
      applicationRefPrefix: ['prefix'],
      facebookUrl: ['url'],
    });
    expect(
      settingsErrors({
        mapLat: '24.7',
        applicationRefPrefix: 'SA',
        facebookUrl: 'https://facebook.com/x',
      }),
    ).toEqual({});
  });
});

describe('mail/SMS templates', () => {
  it('finds placeholders the template does not declare', () => {
    expect(unknownVariables(['Hi {{ name }}, {{link}} {{ other }}'], ['name', 'link'])).toEqual([
      'other',
    ]);
    expect(unknownVariables([null, 'plain'], [])).toEqual([]);
  });

  it('mail templates have a subject; SMS bodies are capped at 480', () => {
    expect(templateFields('mail').map((f) => f.key)).toEqual([
      'name',
      'subject',
      'body',
      'isEnabled',
    ]);
    const sms = templateFields('sms');
    expect(sms.find((f) => f.key === 'body')?.max).toBe(480);
  });
});

describe('interview slots and redirects', () => {
  it('converts Riyadh wall-clock time to an ISO instant with offset and back', () => {
    expect(fromRiyadhInput('2026-10-12T10:00')).toBe('2026-10-12T10:00:00+03:00');
    expect(toRiyadhInput('2026-10-12T07:00:00.000Z')).toBe('2026-10-12T10:00');
    expect(slotLabel('2026-10-12T07:00:00Z', '2026-10-12T07:30:00Z')).toBe(
      'Mon, 12 Oct 2026, 10:00–10:30',
    );
  });

  it('requires the end after the start and sends ISO instants', () => {
    const fields = COLLECTIONS['interviewSlots'].fields;
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
