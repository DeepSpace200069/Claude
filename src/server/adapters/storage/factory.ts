import { getEnv } from '@/lib/env';

import { LocalStorageAdapter } from './local-adapter';
import { S3StorageAdapter } from './s3-adapter';
import type { StorageAdapter } from './types';

/**
 * Izbor storage adaptera prema konfiguraciji.
 *
 * Odvojeno od `index.ts` **bez** `server-only` oznake, jer isti izbor treba i
 * skriptama koje se pokreću iz terminala (uvoz HTML šablona). `server-only`
 * baca grešku van React Server Components okruženja, pa bi CLI pao na uvozu
 * modula, a ne na nečemu što zaista radi.
 *
 * Aplikativni kod i dalje ide preko `index.ts` i time zadržava zaštitu od
 * slučajnog uvoza u klijentsku komponentu.
 */
let cached: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;

  const env = getEnv();

  cached =
    env.STORAGE_DRIVER === 's3'
      ? new S3StorageAdapter({
          endpoint: env.S3_ENDPOINT ?? '',
          region: env.S3_REGION,
          bucket: env.S3_BUCKET ?? '',
          accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
          secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
          publicUrl: env.S3_PUBLIC_URL ?? '',
        })
      : new LocalStorageAdapter({
          appUrl: env.APP_URL,
          // Lokalni potpis koristi AUTH_SECRET da ne uvodimo još jednu tajnu.
          signingSecret: env.AUTH_SECRET ?? 'dev-local-storage-secret',
        });

  return cached;
}

/** Tipizovan pristup lokalnom adapteru (koristi ga `/api/uploads/local`). */
export function getLocalStorageAdapter(): LocalStorageAdapter | null {
  const adapter = getStorageAdapter();
  return adapter instanceof LocalStorageAdapter ? adapter : null;
}

export function setStorageAdapter(adapter: StorageAdapter | null): void {
  cached = adapter;
}
