import { beforeEach, vi } from 'vitest';

/**
 * Priprema unit i DOM testova.
 *
 * Unit testovi ne diraju bazu ni mrežu - sve što bi to pokušalo mora eksplicitno
 * da bude mokovano u samom testu.
 */
// `NODE_ENV` je u Next tipovima read-only, pa ide preko indeksiranog pristupa.
const env = process.env as Record<string, string | undefined>;

env.NODE_ENV ??= 'test';
env.APP_URL ??= 'http://localhost:3000';
env.DATABASE_URL ??= 'postgresql://localhost:5432/unused-in-unit-tests';
env.AUTH_SECRET ??= 'test-secret-vrednost-od-najmanje-32-znaka!!';

beforeEach(() => {
  vi.useRealTimers();
});
