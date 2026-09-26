import { clearDraft, DRAFT_KEY, DRAFT_TTL_MS, loadDraft, saveDraft } from './apply-draft';
import { emptyApplyValue } from './apply-payload';

describe('apply draft (review F5)', () => {
  beforeEach(() => sessionStorage.clear());

  it('stores the draft in sessionStorage without idNumber and birthDate', () => {
    saveDraft(
      { ...emptyApplyValue(), firstName: 'A', idNumber: '123', birthDate: '2000-01-01' },
      1000,
    );
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    const raw = sessionStorage.getItem(DRAFT_KEY) ?? '';
    expect(raw).toContain('"firstName":"A"');
    expect(raw).not.toContain('idNumber');
    expect(raw).not.toContain('birthDate');
    expect(loadDraft(2000)).toEqual({
      savedAt: 1000,
      value: expect.objectContaining({ firstName: 'A' }),
    });
  });

  it('expires after 24h', () => {
    saveDraft({ ...emptyApplyValue(), firstName: 'A' }, 0);
    expect(loadDraft(DRAFT_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('never restores sensitive fields even if they were stored by hand', () => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ savedAt: 0, value: { idNumber: 'x', birthDate: 'y', major: 'm' } }),
    );
    expect(loadDraft(1)?.value).toEqual({ major: 'm' });
  });

  it('clears', () => {
    saveDraft(emptyApplyValue(), 0);
    clearDraft();
    expect(loadDraft(1)).toBeNull();
  });
});
