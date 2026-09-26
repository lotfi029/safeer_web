export const SSR_URL = 'http://localhost:4100';
export const SSR_DEAD_API_URL = 'http://localhost:4101';
export const MOCK_API_URL = 'http://127.0.0.1:3100';
/** Mock-only assertions (the `__echo` / `__log` routes) are skipped against a real API. */
export const usingMockApi = !process.env['E2E_API_URL'];
