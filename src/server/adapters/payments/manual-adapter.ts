import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type {
  PaymentAdapter,
  PaymentIntent,
  PaymentIntentInput,
  RefundInput,
  RefundResult,
  WebhookVerification,
} from './types';

/**
 * Ručna naplata (uplatnica, bankovni transfer, IPS QR).
 *
 * Za razliku od `dev` provajdera, ovaj sme u produkciju: ne tvrdi da je nešto
 * plaćeno, već ostavlja nalog u `pending` dok se uplata ne evidentira. Nalog se
 * potvrđuje iz admin panela, uz zapis u audit log.
 */
export class ManualPaymentAdapter implements PaymentAdapter {
  readonly name = 'manual';
  readonly allowedInProduction = true;

  constructor(private readonly options: { webhookSecret: string }) {}

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntent> {
    return {
      providerRef: `manual_${randomUUID()}`,
      status: 'pending',
      redirectUrl: input.returnUrl,
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  }

  /**
   * Stanje ručne uplate živi isključivo u tabeli `payments` - adapter nema
   * spoljni izvor istine, pa namerno ne izmišlja odgovor.
   */
  async getIntent(): Promise<PaymentIntent | null> {
    return null;
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      providerRef: input.providerRef,
      status: 'refunded',
      refundedMinor: input.amountMinor,
    };
  }

  verifyWebhook(rawBody: string, signature: string | null): WebhookVerification {
    if (!signature) return { ok: false, error: 'Nedostaje potpis webhooka.' };

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

    return { ok: false, error: 'Ručna naplata ne prima webhookove.' };
  }
}
