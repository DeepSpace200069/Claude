import 'server-only';

import { getEnv } from '@/lib/env';

import { ConsoleEmailAdapter } from './console-adapter';
import { ResendEmailAdapter } from './resend-adapter';
import type { EmailAdapter } from './types';

let cached: EmailAdapter | null = null;

/**
 * Vraća konfigurisan email adapter.
 *
 * `console` drajver ne šalje ništa - ispisuje poruku u terminal, uključujući
 * magic link, tako da lokalni razvoj radi bez ijednog spoljnog servisa.
 */
export function getEmailAdapter(): EmailAdapter {
  if (cached) return cached;

  const env = getEnv();
  cached =
    env.EMAIL_DRIVER === 'resend'
      ? new ResendEmailAdapter({
          apiKey: env.RESEND_API_KEY ?? '',
          from: env.EMAIL_FROM,
        })
      : new ConsoleEmailAdapter({ from: env.EMAIL_FROM });

  return cached;
}

/** Samo za testove. */
export function setEmailAdapter(adapter: EmailAdapter | null): void {
  cached = adapter;
}

export type { EmailAdapter, EmailMessage, EmailSendResult } from './types';
