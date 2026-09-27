import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { MAP_FRAME_ORIGINS } from '../app/shared/map/map-embed';

/** Placeholder in `index.html` (`<app-root ngCspNonce="__CSP_NONCE__">`), replaced per response. */
export const CSP_NONCE_PLACEHOLDER = '__CSP_NONCE__';

export function createNonce(): string {
  return randomBytes(18).toString('base64');
}

/**
 * Nonce-based CSP (sessions plan R1). No 'strict-dynamic': Angular's bundles are loaded with
 * `<script type="module" src>` (no nonce) and must be allowed by 'self'. Style attributes emitted by
 * SSR (NgOptimizedImage, host style bindings) need `style-src-attr 'unsafe-inline'`. Frames: only the
 * contact-page map hosts the API accepts for `settings.mapEmbedUrl` (A12).
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${MAP_FRAME_ORIGINS.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
  ].join('; ');
}

export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

/** Static security headers for every response. The CSP header is set on HTML only (see html.ts). */
export function securityHeaders(isProduction: boolean) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

/** Enforced in production; report-only in development (Vite HMR injects inline scripts). */
export function cspHeaderName(isProduction: boolean): string {
  return isProduction ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

export function injectNonce(html: string, nonce: string): string {
  return html.split(CSP_NONCE_PLACEHOLDER).join(nonce);
}
