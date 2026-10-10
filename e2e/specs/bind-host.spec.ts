import { expect, test } from '@playwright/test';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { SSR_URL } from '../support/env';

/** The machine's first non-internal IPv4 address, if it has one. */
function externalIPv4(): string | undefined {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return undefined;
}

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: 2000 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * S2 (VPS deploy review): the SSR server binds HOST (playwright.config.ts sets 127.0.0.1, the default),
 * so it answers on loopback and refuses the machine's other addresses. Before HOST existed,
 * `app.listen(PORT)` bound every interface.
 */
test.describe('HOST (S2)', () => {
  const port = Number(new URL(SSR_URL).port);

  test('answers on 127.0.0.1', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(res.status).toBe(200);
  });

  test("refuses a connection on the machine's own address", async () => {
    const external = externalIPv4();
    test.skip(!external, 'no non-loopback IPv4 address on this machine');
    expect(await canConnect(external!, port)).toBe(false);
  });
});
