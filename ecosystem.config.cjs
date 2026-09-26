/**
 * PM2 process file for the Hostinger Node.js app (sessions plan R11).
 *   pm2 start ecosystem.config.cjs --env production
 * One instance in fork mode: the SSR server is stateless but light, and Hostinger plans cap memory.
 * Environment values (API_INTERNAL_URL, PUBLIC_SITE_URL, PORT, TRUST_PROXY) come from `.env` next to
 * this file or from the hPanel environment; see docs/frontend/deployment.md.
 */
module.exports = {
  apps: [
    {
      name: 'safeer-web',
      script: 'dist/safeer_web/server/server.mjs',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '400M',
      // server.ts closes the HTTP server on SIGTERM and force-exits after 8 s.
      kill_timeout: 10000,
      listen_timeout: 10000,
      out_file: 'logs/safeer-web.out.log',
      error_file: 'logs/safeer-web.err.log',
      merge_logs: true,
      time: true,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
