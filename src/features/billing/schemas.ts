import { z } from 'zod';

/**
 * Ulaz za naplatu (zahtev 17).
 *
 * Promo kod je neobavezan, ali kada je unet mora da se proveri - servis vraća
 * grešku za nevažeći kod umesto da ga tiho ignoriše.
 */
export const startCheckoutSchema = z.object({
  eventId: z.uuid('Neispravan identifikator događaja.'),
  planId: z.uuid('Izaberite paket.'),
  promoCode: z
    .string()
    .trim()
    .max(40, 'Promo kod je predugačak.')
    .optional()
    .transform((value) => value || undefined),
});

export type StartCheckoutInput = z.input<typeof startCheckoutSchema>;
