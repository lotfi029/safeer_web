export const SSR_URL = 'http://localhost:4100';
export const SSR_DEAD_API_URL = 'http://localhost:4101';
export const MOCK_API_URL = 'http://127.0.0.1:3100';
/** True unless E2E_API_URL points the run at a real safeer_api (the `e2e-real` CI job, W24). */
export const usingMockApi = !process.env['E2E_API_URL'];

/**
 * W24: tags a test or describe block `@mock-only`. playwright.config.ts drops these with `grepInvert`
 * when E2E_API_URL is set, and the reason shows as an annotation in the report. Use it only for what
 * genuinely can't run against the real API: mock-only routes (`__echo`, `__log`, `__site`), mock
 * accounts and tokens, and assertions bound to fixture content or counts that the API's dev seed doesn't
 * have. List them all with `npx playwright test --list --grep @mock-only`.
 */
export function mockOnly(reason: string) {
  return { tag: '@mock-only', annotation: { type: 'mock-only', description: reason } };
}
