import { cleanupRealDb, closeRealDb } from './real-db';

/** Real-API runs only: removes every `@e2e.invalid` staff user, including a crashed worker's. */
export default async function globalTeardown(): Promise<void> {
  await cleanupRealDb();
  await closeRealDb();
}
