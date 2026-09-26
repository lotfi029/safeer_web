import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import type { Request } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

export const PROXY_TIMEOUT_MS = 30_000;
export const PROXIED_PATHS = ['/api/**', '/files/**'];

/** Headers a client could use to spoof its address; stripped before forwarding. */
const SPOOFABLE = [
  'forwarded',
  'x-real-ip',
  'x-client-ip',
  'true-client-ip',
  'x-forwarded-port',
  'x-forwarded-prefix',
];

/**
 * Sessions plan R3: overwrite (never append) the forwarding headers so the API, which trusts one
 * hop, sees the real client IP as resolved by Express `trust proxy`.
 */
export function rewriteForwardingHeaders(
  proxyReq: Pick<ClientRequest, 'setHeader' | 'removeHeader'>,
  client: { ip?: string; protocol: string; host?: string },
): void {
  for (const header of SPOOFABLE) {
    proxyReq.removeHeader(header);
  }
  if (client.ip) {
    proxyReq.setHeader('x-forwarded-for', client.ip);
  } else {
    proxyReq.removeHeader('x-forwarded-for');
  }
  proxyReq.setHeader('x-forwarded-proto', client.protocol);
  if (client.host) {
    proxyReq.setHeader('x-forwarded-host', client.host);
  }
}

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: string;
}

export function upstreamProblem(errorCode: string | undefined): ProblemBody {
  const timedOut =
    errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKETTIMEDOUT' || errorCode === 'ECONNRESET';
  return timedOut
    ? {
        type: 'https://safeer-sa.org/errors/upstream-timeout',
        title: 'Upstream timeout',
        status: 504,
        code: 'UPSTREAM_TIMEOUT',
      }
    : {
        type: 'https://safeer-sa.org/errors/upstream-unavailable',
        title: 'Upstream unavailable',
        status: 502,
        code: 'UPSTREAM_UNAVAILABLE',
      };
}

/**
 * Same-origin proxy for `/api/*` and `/files/*` → API_INTERNAL_URL. Cookies, `Set-Cookie` and
 * `Accept-Language` pass through untouched; bodies are streamed (no body parser is mounted before it).
 */
export function apiProxy(apiInternalUrl: string) {
  return createProxyMiddleware<Request, ServerResponse>({
    target: apiInternalUrl,
    pathFilter: PROXIED_PATHS,
    changeOrigin: true,
    xfwd: false,
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: PROXY_TIMEOUT_MS,
    on: {
      proxyReq: (proxyReq, req) => {
        rewriteForwardingHeaders(proxyReq, { ip: req.ip, protocol: req.protocol, host: req.host });
      },
      error: (
        err: Error & { code?: string },
        _req: IncomingMessage,
        res: ServerResponse | Socket,
      ) => {
        if (!('writeHead' in res)) {
          res.destroy();
          return;
        }
        const problem = upstreamProblem(err.code);
        if (!res.headersSent) {
          res.writeHead(problem.status, {
            'Content-Type': 'application/problem+json',
            'Cache-Control': 'no-store',
          });
        }
        res.end(JSON.stringify(problem));
      },
    },
  });
}
