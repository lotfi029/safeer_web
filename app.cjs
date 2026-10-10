/**
 * CommonJS start file for runners that `require()` the entry instead of running it, such as
 * Hostinger's Node.js apps (LiteSpeed `lsnode.js`). `require()` of the ESM server would not count as
 * the main module, so the server would never listen; this sets the flag server.ts checks and loads
 * the ESM bundle with a dynamic import. PM2 and `node dist/safeer_web/server/server.mjs` don't need
 * it. See docs/frontend/deployment.md.
 */
process.env.SAFEER_SSR_LISTEN = '1';
import('./dist/safeer_web/server/server.mjs').catch((error) => {
  console.error(error);
  process.exit(1);
});
