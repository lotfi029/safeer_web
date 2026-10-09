import { isIP } from 'node:net';

/**
 * Server environment: loads `.env` (if present) and validates the variables the SSR server needs.
 * Production fails fast (and fails closed for host validation); development falls back to local defaults.
 */
export interface ServerEnv {
  readonly isProduction: boolean;
  /** Origin of the NestJS API, e.g. `http://127.0.0.1:3000` (no trailing slash, no `/api/v1`). */
  readonly apiInternalUrl: string;
  /** Public origin of this site, e.g. `https://safeer-sa.org`. */
  readonly publicSiteUrl: string;
  readonly port: number;
  /** Address `app.listen` binds (S2): `127.0.0.1` by default, `0.0.0.0` in the Docker image. */
  readonly host: string;
  /** Express `trust proxy` hop count (number of reverse proxies in front of this server). */
  readonly trustProxy: number;
  /** Hostnames Angular SSR accepts in `Host` / `X-Forwarded-Host`. */
  readonly allowedHosts: readonly string[];
}

const DEV_DEFAULTS = {
  API_INTERNAL_URL: 'http://127.0.0.1:3000',
  PUBLIC_SITE_URL: 'http://localhost:4000',
  PORT: '4000',
  HOST: '127.0.0.1',
  TRUST_PROXY: '1',
} as const;

/** Loads `.env` from the working directory. A missing file is not an error. */
export function loadDotEnv(path = '.env'): void {
  try {
    process.loadEnvFile(path);
  } catch {
    // No .env file: rely on the process environment (PM2 / hPanel).
  }
}

export class EnvError extends Error {}

function parseOrigin(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EnvError(`${name} must be an absolute http(s) URL, got "${value}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new EnvError(`${name} must use http or https, got "${url.protocol}"`);
  }
  return url.origin;
}

function parseIntInRange(name: string, value: string, min: number, max: number): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new EnvError(`${name} must be an integer, got "${value}"`);
  }
  const n = Number(value);
  if (n < min || n > max) {
    throw new EnvError(`${name} must be between ${min} and ${max}, got ${n}`);
  }
  return n;
}

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/** A bind address: an IPv4/IPv6 literal or a hostname. No scheme, port or brackets. */
function parseHost(name: string, value: string): string {
  if (isIP(value) || HOSTNAME.test(value)) {
    return value;
  }
  throw new EnvError(
    `${name} must be an IP address or a hostname (no scheme or port), got "${value}"`,
  );
}

/** `http://host:port` for log lines; IPv6 literals in brackets. */
export function listenUrl(host: string, port: number): string {
  return `http://${isIP(host) === 6 ? `[${host}]` : host}:${port}`;
}

/** Apex + `www` of the public host, plus localhost outside production. */
export function allowedHostsFor(publicSiteUrl: string, isProduction: boolean): string[] {
  const host = new URL(publicSiteUrl).hostname.toLowerCase();
  const apex = host.startsWith('www.') ? host.slice(4) : host;
  const hosts = new Set<string>([apex]);
  const isIpOrLocal = apex === 'localhost' || /^[\d.]+$/.test(apex) || apex.includes(':');
  if (!isIpOrLocal) {
    hosts.add(`www.${apex}`);
  }
  if (!isProduction) {
    hosts.add('localhost');
    hosts.add('127.0.0.1');
  }
  return [...hosts];
}

/**
 * @param strict when true (production server start), required variables must be set explicitly.
 */
export function parseEnv(raw: NodeJS.ProcessEnv, strict: boolean): ServerEnv {
  const isProduction = raw['NODE_ENV'] === 'production';
  const read = (name: keyof typeof DEV_DEFAULTS, required: boolean): string => {
    const value = raw[name]?.trim();
    if (value) {
      return value;
    }
    if (required) {
      throw new EnvError(`${name} is required in production`);
    }
    return DEV_DEFAULTS[name];
  };
  const requireAll = strict && isProduction;
  const apiInternalUrl = parseOrigin('API_INTERNAL_URL', read('API_INTERNAL_URL', requireAll));
  const publicSiteUrl = parseOrigin('PUBLIC_SITE_URL', read('PUBLIC_SITE_URL', requireAll));
  return {
    isProduction,
    apiInternalUrl,
    publicSiteUrl,
    port: parseIntInRange('PORT', read('PORT', false), 1, 65535),
    host: parseHost('HOST', read('HOST', false)),
    trustProxy: parseIntInRange('TRUST_PROXY', read('TRUST_PROXY', false), 0, 10),
    allowedHosts: allowedHostsFor(publicSiteUrl, isProduction),
  };
}
