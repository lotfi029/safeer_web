import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, problemMessageKey, toApiProblem } from './problem';

describe('toApiProblem', () => {
  it('maps RFC 7807 + zod issues to field errors and keeps extras', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        type: 'https://safeer-sa.org/errors/validation-failed',
        title: 'Validation failed',
        status: 400,
        code: 'VALIDATION_FAILED',
        requestId: 'r1',
        issues: [
          { path: ['email'], message: 'Invalid email', code: 'invalid_string' },
          { path: ['email'], message: 'Too long', code: 'too_big' },
          { path: [], message: 'Oops', code: 'custom' },
        ],
      },
    });
    const p = toApiProblem(error);
    expect(p.code).toBe('VALIDATION_FAILED');
    expect(p.requestId).toBe('r1');
    expect(p.fieldErrors['email']).toEqual(['Invalid email', 'Too long']);
    expect(p.fieldErrors['_']).toEqual(['Oops']);
  });

  it('keeps extra members such as DOCUMENTS_INCOMPLETE.missing', () => {
    const p = toApiProblem(
      new HttpErrorResponse({
        status: 409,
        error: { code: 'DOCUMENTS_INCOMPLETE', title: 'x', status: 409, missing: ['id_copy'] },
      }),
    );
    expect(p.extra['missing']).toEqual(['id_copy']);
  });

  it('falls back to a code from the status, and recognises network errors', () => {
    expect(toApiProblem(new HttpErrorResponse({ status: 429, error: 'text' })).code).toBe(
      'RATE_LIMITED',
    );
    expect(toApiProblem(new HttpErrorResponse({ status: 0 })).code).toBe('NETWORK');
  });

  it('unwraps ApiError and maps codes to Transloco keys', () => {
    const problem = toApiProblem(new HttpErrorResponse({ status: 401 }));
    expect(toApiProblem(new ApiError(problem))).toBe(problem);
    expect(problemMessageKey({ code: 'OTP_INVALID' })).toBe('errors.codes.OTP_INVALID');
    expect(problemMessageKey({ code: 'NETWORK' })).toBe('errors.network');
    expect(problemMessageKey({ code: 'SOMETHING_NEW' })).toBe('errors.generic');
  });
});
