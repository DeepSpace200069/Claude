import 'dotenv/config';

/**
 * Priprema integracionih testova.
 *
 * Testovi rade nad **zasebnom** bazom (`TEST_DATABASE_URL`) da ne bi obrisali
 * razvojne podatke. Ako promenljiva nije postavljena, `tests/integration/db.ts`
 * preskače celu grupu testova umesto da padne - tako `pnpm test:all` radi i na
 * mašini bez baze.
 */
// `NODE_ENV` je u Next tipovima označen kao read-only, pa se postavlja preko
// indeksiranog pristupa.
const env = process.env as Record<string, string | undefined>;

if (env.TEST_DATABASE_URL) {
  env.DATABASE_URL = env.TEST_DATABASE_URL;
}

env.NODE_ENV ??= 'test';
env.APP_URL ??= 'http://localhost:3000';
env.AUTH_SECRET ??= 'test-secret-vrednost-od-najmanje-32-znaka!!';
env.EMAIL_DRIVER ??= 'console';
env.PAYMENT_DRIVER ??= 'dev';
