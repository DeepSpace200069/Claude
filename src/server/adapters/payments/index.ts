import 'server-only';

import { getEnv } from '@/lib/env';

import { DevPaymentAdapter } from './dev-adapter';
import { ManualPaymentAdapter } from './manual-adapter';
import type { PaymentAdapter } from './types';

let cached: PaymentAdapter | null = null;

/**
 * Vraća konfigurisan payment adapter.
 *
 * Ako je izabran provajder koji nije dozvoljen u produkciji, fabrika odbija da
 * ga instancira. To je namerno tvrda greška: bolje je da objavljivanje ne radi
 * nego da korisnik u produkciji vidi lažnu potvrdu uplate (zahtev 17).
 */
export function getPaymentAdapter(): PaymentAdapter {
  if (cached) return cached;

  const env = getEnv();
  const adapter =
    env.PAYMENT_DRIVER === 'manual'
      ? new ManualPaymentAdapter({ webhookSecret: env.PAYMENT_WEBHOOK_SECRET })
      : new DevPaymentAdapter({ webhookSecret: env.PAYMENT_WEBHOOK_SECRET });

  if (env.NODE_ENV === 'production' && !adapter.allowedInProduction) {
    throw new Error(
      `Payment provajder "${adapter.name}" nije dozvoljen u produkciji. ` +
        'Postavi PAYMENT_DRIVER na provajdera koji stvarno naplaćuje.',
    );
  }

  cached = adapter;
  return cached;
}

export function setPaymentAdapter(adapter: PaymentAdapter | null): void {
  cached = adapter;
}

export * from './types';
export { DevPaymentAdapter } from './dev-adapter';
export { ManualPaymentAdapter } from './manual-adapter';
