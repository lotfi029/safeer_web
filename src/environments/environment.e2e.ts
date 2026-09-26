/**
 * `ng build -c e2e`: production optimisations and enforced CSP, plus `/_kit` for the Playwright matrix
 * (review F6). The API is the Node mock server (or a real API), never the in-app mock interceptor.
 */
export const environment = {
  production: true,
  useMocks: false,
  kit: true,
};
