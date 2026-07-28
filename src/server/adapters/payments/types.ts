/**
 * Payment adapter (zahtev 17 i 39.7).
 *
 * Poslovna logika ne sme da zavisi ni od jednog konkretnog provajdera. Sve što
 * aplikacija koristi je ovaj interfejs; kartice, IPS QR ili bankovni transfer
 * dodaju se kao nove implementacije, bez izmene logike objavljivanja.
 */
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type PaymentIntentInput = {
  orderId: string;
  amountMinor: number;
  currency: string;
  description: string;
  /**
   * Ključ idempotencije. Isti ključ mora dati isti rezultat bez dvostruke
   * naplate, koliko god puta se poziv ponovio.
   */
  idempotencyKey: string;
  returnUrl: string;
  metadata?: Record<string, string>;
};

export type PaymentIntent = {
  /** Identifikator kod provajdera. */
  providerRef: string;
  status: PaymentStatus;
  /** URL na koji se korisnik preusmerava; `null` kada plaćanje nije interaktivno. */
  redirectUrl: string | null;
  amountMinor: number;
  currency: string;
};

export type RefundInput = {
  providerRef: string;
  amountMinor: number;
  reason?: string;
};

export type RefundResult = {
  providerRef: string;
  status: PaymentStatus;
  refundedMinor: number;
};

export type WebhookVerification =
  | {
      ok: true;
      /** Jedinstven ID događaja - koristi se za idempotentnu obradu. */
      eventId: string;
      type: string;
      providerRef: string;
      status: PaymentStatus;
      amountMinor: number;
      payload: Record<string, unknown>;
    }
  | { ok: false; error: string };

export interface PaymentAdapter {
  readonly name: string;
  /** Da li provajder sme da se koristi u produkciji. */
  readonly allowedInProduction: boolean;

  createIntent(input: PaymentIntentInput): Promise<PaymentIntent>;
  getIntent(providerRef: string): Promise<PaymentIntent | null>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** Provera potpisa webhooka - nikad ne verujemo telu zahteva bez nje. */
  verifyWebhook(rawBody: string, signature: string | null): WebhookVerification;
}

/**
 * Dozvoljeni prelazi stanja naplate.
 *
 * Držimo ih na jednom mestu da bi svaki provajder i svaki webhook prolazili
 * kroz istu proveru: webhookovi stižu van redosleda i ponavljaju se, pa
 * `succeeded -> pending` mora biti odbijen.
 */
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['pending', 'succeeded', 'failed'],
  succeeded: ['succeeded', 'refunded'],
  failed: ['failed', 'pending'],
  refunded: ['refunded'],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Vraća naredno stanje ili grešku ako je prelaz nedozvoljen. */
export function transition(
  from: PaymentStatus,
  to: PaymentStatus,
): { ok: true; status: PaymentStatus } | { ok: false; error: string } {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      error: `Nedozvoljen prelaz stanja naplate: ${from} -> ${to}.`,
    };
  }
  return { ok: true, status: to };
}
