import { defineConfig, devices } from '@playwright/test';

/**
 * e2e runs the `e2e` build configuration (production optimisations, enforced CSP, NODE_ENV=production)
 * against the Node mock API, or a real API when E2E_API_URL is set (CI variable).
 */
const SSR_PORT = 4100;
const SSR_DEAD_API_PORT = 4101;
const MOCK_API_PORT = 3100;
const apiUrl = process.env['E2E_API_URL'] || `http://127.0.0.1:${MOCK_API_PORT}`;
const serverEntry = 'dist/safeer_web-e2e/server/server.mjs';
// Local sessions use the pre-installed Chromium; CI installs Playwright's own.
const executablePath = process.env['PW_CHROMIUM_PATH'] || undefined;

const ssrEnv = (port: number, api: string) => ({
  NODE_ENV: 'production',
  PORT: String(port),
  API_INTERNAL_URL: api,
  PUBLIC_SITE_URL: `http://localhost:${port}`,
  TRUST_PROXY: '1',
});

export default defineConfig({
  testDir: 'e2e/specs',
  outputDir: 'test-results',
  // Real-API runs: sweep any @e2e.invalid staff a crashed worker left behind (e2e/support/real-db.ts).
  globalTeardown: process.env['E2E_API_URL'] ? './e2e/support/global-teardown.ts' : undefined,
  // W24: `@mock-only` specs (e2e/support/env.ts mockOnly) need the mock API; the real-API run drops them.
  // E2E_INCLUDE_MOCK_ONLY=1 runs them anyway (to check which would now pass against the real API).
  grepInvert:
    process.env['E2E_API_URL'] && !process.env['E2E_INCLUDE_MOCK_ONLY'] ? /@mock-only/ : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${SSR_PORT}`,
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
  ],
  webServer: [
    ...(process.env['E2E_API_URL']
      ? []
      : [
          {
            command: 'node e2e/mock-api/server.mjs',
            url: `http://127.0.0.1:${MOCK_API_PORT}/api/v1/health`,
            env: { MOCK_API_PORT: String(MOCK_API_PORT) },
            reuseExistingServer: !process.env['CI'],
          },
        ]),
    {
      command: `node ${serverEntry}`,
      url: `http://localhost:${SSR_PORT}/healthz`,
      env: ssrEnv(SSR_PORT, apiUrl),
      reuseExistingServer: !process.env['CI'],
    },
    {
      // Same build pointed at a closed port: exercises the 502 problem+json path (R7).
      command: `node ${serverEntry}`,
      url: `http://localhost:${SSR_DEAD_API_PORT}/healthz`,
      env: ssrEnv(SSR_DEAD_API_PORT, 'http://127.0.0.1:9'),
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
