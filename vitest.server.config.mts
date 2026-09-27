import { defineConfig } from 'vitest/config';

/** Node-environment unit tests for server.ts modules and repo scripts (`npm run test:server`). */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/server/**/*.test.ts',
      'scripts/**/*.test.mjs',
      'mocks/**/*.test.mjs',
      'e2e/support/**/*.test.ts',
      // Pure-TS app modules checked against the API snapshot in docs/api (drift tests).
      'src/app/**/*.node.test.ts',
    ],
  },
});
