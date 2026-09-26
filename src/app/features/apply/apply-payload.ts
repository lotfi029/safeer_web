import type {
  ApplicationPatch,
  ApplicationStep1,
  DegreeLevel,
  Gender,
  PortalMe,
} from '../../core/api/models';

/** Flat model behind the three apply steps (Signal Forms). Empty = `''` / `false`. */
export interface ApplyFormValue {
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  nationality: string;
  idNumber: string;
  email: string;
  currentJob: string;
  gender: Gender | '';
  university: string;
  major: string;
  degreeLevel: DegreeLevel | '';
  scholarshipNote: string;
  consent: boolean;
}

export type ApplyField = keyof ApplyFormValue;

export const STEP1_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'birthDate',
  'phone',
  'nationality',
  'idNumber',
  'email',
  'currentJob',
  'gender',
] as const satisfies readonly ApplyField[];

export const STEP2_FIELDS = [
  'university',
  'major',
  'degreeLevel',
  'scholarshipNote',
] as const satisfies readonly ApplyField[];

/** The only fields the API accepts as `null` (CONTRACT-NOTES, review F4). */
export const NULLABLE_FIELDS: ReadonlySet<ApplyField> = new Set([
  'middleName',
  'idNumber',
  'currentJob',
  'scholarshipNote',
]);

export function emptyApplyValue(): ApplyFormValue {
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    birthDate: '',
    phone: '',
    nationality: '',
    idNumber: '',
    email: '',
    currentJob: '',
    gender: '',
    university: '',
    major: '',
    degreeLevel: '',
    scholarshipNote: '',
    consent: false,
  };
}

/** Normalises one field for the wire: trimmed text, upper-case ISO country, `null`/omit rule. */
function wireValue(key: ApplyField, value: ApplyFormValue[ApplyField]): unknown {
  if (typeof value === 'boolean') {
    return value;
  }
  const text = key === 'nationality' ? value.trim().toUpperCase() : value.trim();
  if (text) {
    return text;
  }
  return NULLABLE_FIELDS.has(key) ? null : undefined;
}

/**
 * Autosave payload (review F4): only the given fields, trimmed. An empty nullable field
 * (middleName, idNumber, currentJob, scholarshipNote) is sent as `null` to clear it; any other empty
 * field is omitted — never `""` and never `null` (the PATCH schema is strict).
 */
export function toPatch(value: ApplyFormValue, fields: readonly ApplyField[]): ApplicationPatch {
  const patch: Record<string, unknown> = {};
  for (const key of fields) {
    const v = wireValue(key, value[key]);
    if (v !== undefined) {
      patch[key] = v;
    }
  }
  return patch as ApplicationPatch;
}

/** Fields whose value differs between two snapshots (after trimming). */
export function changedFields(before: ApplyFormValue, after: ApplyFormValue): ApplyField[] {
  return (Object.keys(after) as ApplyField[]).filter(
    (k) => wireValue(k, before[k]) !== wireValue(k, after[k]),
  );
}

/** `POST /applications` body: step-1 fields; empty optional fields are left out. */
export function toStep1(value: ApplyFormValue): ApplicationStep1 {
  const body = toPatch(value, STEP1_FIELDS) as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (body[key] === null) {
      delete body[key];
    }
  }
  return body as unknown as ApplicationStep1;
}

/** Rebuilds the form value from `GET /portal/me` when an applicant resumes a draft. */
export function fromMe(me: PortalMe): ApplyFormValue {
  const base = emptyApplyValue();
  const p = me.personal;
  const s = me.study;
  return {
    ...base,
    firstName: p.firstName ?? '',
    middleName: p.middleName ?? '',
    lastName: p.lastName ?? '',
    birthDate: p.birthDate ?? '',
    phone: p.phone ?? '',
    nationality: p.nationality ?? '',
    idNumber: p.idNumber ?? '',
    email: p.email ?? '',
    currentJob: p.currentJob ?? '',
    gender: p.gender ?? '',
    university: s.university ?? '',
    major: s.major ?? '',
    degreeLevel: s.degreeLevel ?? '',
    scholarshipNote: s.scholarshipNote ?? '',
  };
}
