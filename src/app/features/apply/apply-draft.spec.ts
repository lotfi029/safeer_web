import { clearDraft, DRAFT_KEY, DRAFT_TTL_MS, loadDraft, saveDraft } from './apply-draft';
import { emptyApplyValue } from './apply-payload';

describe('apply draft (review F5)', () => {
  beforeEach(() => sessionStorage.clear());

  it('stores the draft in sessionStorage without idNumber and birthDate', () => {
    saveDraft(
      { ...emptyApplyValue(), firstName: 'A', idNumber: '123', birthDate: '2000-01-01' },
      'SA-2026-00001',
      1000,
    );
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    const raw = sessionStorage.getItem(DRAFT_KEY) ?? '';
    expect(raw).toContain('"firstName":"A"');
    expect(raw).not.toContain('idNumber');
    expect(raw).not.toContain('birthDate');
    expect(loadDraft('SA-2026-00001', 2000)).toEqual({
      savedAt: 1000,
      value: expect.objectContaining({ firstName: 'A' }),
    });
  });

  it('expires after 24h', () => {
    saveDraft({ ...emptyApplyValue(), firstName: 'A' }, 'SA-2026-00001', 0);
    expect(loadDraft('SA-2026-00001', DRAFT_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('never restores sensitive fields even if they were stored by hand', () => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        savedAt: 0,
        reference: 'SA-2026-00001',
        value: { idNumber: 'x', birthDate: 'y', major: 'm' },
      }),
    );
    expect(loadDraft('SA-2026-00001', 1)?.value).toEqual({ major: 'm' });
  });

  it('clears', () => {
    saveDraft(emptyApplyValue(), 'SA-2026-00001', 0);
    clearDraft();
    expect(loadDraft('SA-2026-00001', 1)).toBeNull();
  });

  it('is never offered to another application, and is dropped when found (W10)', () => {
    saveDraft({ ...emptyApplyValue(), firstName: 'A' }, 'SA-2026-00001', 0);
    expect(loadDraft('SA-2026-00002', 1)).toBeNull();
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    // A copy from before W10 (no reference) is dropped too.
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: 0, value: { major: 'm' } }));
    expect(loadDraft('SA-2026-00001', 1)).toBeNull();
  });
});
