import {
  changedFields,
  emptyApplyValue,
  fromMe,
  toPatch,
  toStep1,
  type ApplyFormValue,
} from './apply-payload';
import type { PortalMe } from '../../core/api/models';

function value(overrides: Partial<ApplyFormValue> = {}): ApplyFormValue {
  return { ...emptyApplyValue(), ...overrides };
}

describe('toPatch (review F4)', () => {
  it('sends null only for the four nullable fields when they are empty', () => {
    const patch = toPatch(value(), ['middleName', 'idNumber', 'currentJob', 'scholarshipNote']);
    expect(patch).toEqual({
      middleName: null,
      idNumber: null,
      currentJob: null,
      scholarshipNote: null,
    });
  });

  it('omits every other empty field — never "" and never null', () => {
    const patch = toPatch(value({ firstName: '   ' }), [
      'firstName',
      'lastName',
      'birthDate',
      'phone',
      'nationality',
      'email',
      'gender',
      'university',
      'major',
      'degreeLevel',
    ]);
    expect(patch).toEqual({});
  });

  it('trims text, upper-cases the country and keeps consent booleans', () => {
    const patch = toPatch(
      value({ firstName: '  Sara ', nationality: 'eg', consent: true, degreeLevel: 'master' }),
      ['firstName', 'nationality', 'consent', 'degreeLevel'],
    );
    expect(patch).toEqual({
      firstName: 'Sara',
      nationality: 'EG',
      consent: true,
      degreeLevel: 'master',
    });
  });

  it('only includes the requested fields', () => {
    expect(toPatch(value({ firstName: 'A', lastName: 'B' }), ['lastName'])).toEqual({
      lastName: 'B',
    });
  });
});

describe('changedFields', () => {
  it('ignores whitespace-only edits and reports real changes', () => {
    const before = value({ major: 'Law' });
    expect(changedFields(before, value({ major: 'Law  ' }))).toEqual([]);
    expect(changedFields(before, value({ major: 'Medicine' }))).toEqual(['major']);
    expect(changedFields(before, value({ major: 'Law', consent: true }))).toEqual(['consent']);
  });
});

describe('toStep1', () => {
  it('drops empty optional fields instead of sending null', () => {
    const body = toStep1(
      value({
        firstName: 'A',
        lastName: 'B',
        birthDate: '2000-01-02',
        phone: '+966500000000',
        nationality: 'sa',
        email: 'a@example.invalid',
        gender: 'female',
        university: 'ignored in step 1',
      }),
    );
    expect(body).toEqual({
      firstName: 'A',
      lastName: 'B',
      birthDate: '2000-01-02',
      phone: '+966500000000',
      nationality: 'SA',
      email: 'a@example.invalid',
      gender: 'female',
    });
  });
});

describe('fromMe', () => {
  it('maps nulls to empty strings', () => {
    const me = {
      personal: { firstName: 'A', middleName: null, gender: 'male' },
      study: { degreeLevel: 'phd', scholarshipNote: null },
    } as unknown as PortalMe;
    const v = fromMe(me);
    expect(v.firstName).toBe('A');
    expect(v.middleName).toBe('');
    expect(v.gender).toBe('male');
    expect(v.degreeLevel).toBe('phd');
    expect(v.consent).toBe(false);
  });
});
