import { z } from 'zod';

/**
 * Šeme za objavljivanje i privatnost javne pozivnice (zahtev 21 i 23).
 *
 * Iste šeme koristi i forma (za trenutnu poruku) i server akcija (kao stvarna
 * provera). Podrazumevani režim je `unlisted`: pozivnica se ne indeksira dok
 * organizator to izričito ne dozvoli.
 */
export const INVITATION_PRIVACY = ['public', 'unlisted', 'pin', 'invite_only'] as const;

export type InvitationPrivacy = (typeof INVITATION_PRIVACY)[number];

/** PIN je kratka zajednička šifra za goste - cifre, da se lako izdiktira. */
export const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, 'PIN mora imati od 4 do 8 cifara.');

/**
 * Podešavanja javne pozivnice.
 *
 * Zod ovde proverava samo **oblik**. Pravilo „za režim sa PIN-om mora postojati
 * PIN” zavisi od toga da li je PIN već sačuvan, pa se proverava na serveru,
 * gde se baza uopšte može pogledati.
 */
export const privacySettingsSchema = z.object({
  eventId: z.uuid(),
  privacy: z.enum(INVITATION_PRIVACY),
  /** Prazno polje znači „ne menjaj postojeći PIN”. */
  pin: z.union([pinSchema, z.literal('')]).default(''),
  /** Prazno polje uklanja datum isteka. */
  expiresOn: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')])
    .default(''),
  shareTitle: z.string().trim().max(120).default(''),
  shareDescription: z.string().trim().max(300).default(''),
});

export type PrivacySettingsInput = z.infer<typeof privacySettingsSchema>;
export type PrivacySettingsFormValues = z.input<typeof privacySettingsSchema>;

export const publishSchema = z.object({ eventId: z.uuid() });

export const verifyPinSchema = z.object({
  slug: z.string().trim().min(3).max(60),
  pin: z.string().trim().min(1).max(16),
});

export const recordShareSchema = z.object({
  eventId: z.uuid(),
  channel: z.enum(['copy', 'native', 'whatsapp', 'viber', 'email', 'sms', 'qr']),
});
