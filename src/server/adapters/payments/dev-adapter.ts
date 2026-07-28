import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type {
  PaymentAdapter,
  PaymentIntent,
  PaymentIntentInput,
  PaymentStatus,
  RefundInput,
  RefundResult,
  WebhookVerification,
} from './types';

function isPaymentStatus(value: string): value is PaymentStatus {
  return ['pending', 'succeeded', 'failed', 'refunded'].includes(value);
}

/**
 * Development provajder.
 *
 * Ne naplaćuje ništa: pravi nalog u stanju `pending`, a administrator ga ručno
 * označava kao plaćen. `allowedInProduction = false` je namerno - fabrika
 * odbija da ga instancira kada je `NODE_ENV=production`, pa lažno uspešno
 * plaćanje ne može da se prikaže korisniku (zahtev 17, poslednji red).
 */
export class DevPaymentAdapter implements PaymentAdapter {
  readonly name = 'dev';
  readonly allowedInProduction = false;

  /** Nalozi žive u memoriji procesa; trajno stanje je u tabeli `payments`. */
  private readonly intents = new Map<string, PaymentIntent>();
  private readonly byIdempotencyKey = new Map<string, string>();

  constructor(private readonly options: { webhookSecret: string }) {}

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    // Idempotencija: isti ključ vraća isti nalog umesto novog.
    const existingRef = this.byIdempotencyKey.get(input.idempotencyKey);
    if (existingRef) {
      const existing = this.intents.get(existingRef);
      if (existing) return existing;
    }

    const intent: PaymentIntent = {
      providerRef: `dev_${randomUUID()}`,
      status: 'pending',
      // Bez spoljne stranice: korisnik se vraća na svoju pozivnicu i vidi da
      // naplata čeka potvrdu administratora.
      redirectUrl: input.returnUrl,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };

    this.intents.set(intent.providerRef, intent);
    this.byIdempotencyKey.set(input.idempotencyKey, intent.providerRef);
    return intent;
  }

  async getIntent(providerRef: string): Promise<PaymentIntent | null> {
    return this.intents.get(providerRef) ?? null;
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const intent = this.intents.get(input.providerRef);
    if (intent) {
      this.intents.set(input.providerRef, { ...intent, status: 'refunded' });
    }
    return {
      providerRef: input.providerRef,
      status: 'refunded',
      refundedMinor: input.amountMinor,
    };
  }

  /**
   * Provera potpisa webhooka.
   *
   * Iako je provajder lažni, potpis se stvarno proverava - tako je isti put
   * koda pokriven testovima kao i kod pravog provajdera.
   */
  verifyWebhook(rawBody: string, signature: string | null): WebhookVerification {
    if (!signature) {
      return { ok: false, error: 'Nedostaje potpis webhooka.' };
    }

    const expected = createHmac('sha256', this.options.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const provided = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (
      provided.length !== expectedBuffer.length ||
      !timingSafeEqual(provided, expectedBuffer)
    ) {
      return { ok: false, error: 'Potpis webhooka nije ispravan.' };
    }

    try {
      const payload = JSON.parse(rawBody) as {
        id?: string;
        type?: string;
        providerRef?: string;
        status?: string;
        amountMinor?: number;
      };

      if (!payload.id || !payload.providerRef || !payload.status) {
        return { ok: false, error: 'Nepotpun webhook payload.' };
      }

      if (!isPaymentStatus(payload.status)) {
        return { ok: false, error: `Nepoznat status naplate: ${payload.status}` };
      }

      return {
        ok: true,
        eventId: payload.id,
        type: payload.type ?? 'payment.updated',
        providerRef: payload.providerRef,
        status: payload.status,
        amountMinor: payload.amountMinor ?? 0,
        payload: payload as Record<string, unknown>,
      };
    } catch {
      return { ok: false, error: 'Webhook payload nije ispravan JSON.' };
    }
  }

  /** Pomoćna metoda za admin panel i testove: ručno označavanje kao plaćeno. */
  markPaid(providerRef: string): void {
    const intent = this.intents.get(providerRef);
    if (intent) {
      this.intents.set(providerRef, { ...intent, status: 'succeeded' });
    }
  }

  /** Potpis kojim testovi i admin alat potpisuju simulirani webhook. */
  signPayload(rawBody: string): string {
    return createHmac('sha256', this.options.webhookSecret)
      .update(rawBody)
      .digest('hex');
  }
}
