import { z } from 'zod';

/**
 * Šeme za goste i domaćinstva (zahtev 12).
 *
 * Namerno vrlo malo obaveznih polja: organizator često zna samo ime, a tera ga
 * se da unese email i telefon. Kontakt je koristan, ali nije uslov da gost
 * postoji u spisku.
 */
export const guestNameSchema = z.string().trim().min(1).max(80);

export const guestSchema = z.object({
  firstName: guestNameSchema,
  lastName: z.string().trim().max(80).default(''),
  email: z.union([z.email().max(160), z.literal('')]).default(''),
  phone: z
    .union([
      z
        .string()
        .trim()
        .max(32)
        .regex(/^[+()\d\s./-]+$/, 'Telefon sme da sadrži samo cifre i znakove + ( ) - . /'),
      z.literal(''),
    ])
    .default(''),
  isChild: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  /** Beleška koju gost nikad ne vidi. */
  privateNote: z.string().trim().max(500).default(''),
  householdId: z.union([z.uuid(), z.literal('')]).default(''),
});

export type GuestInput = z.infer<typeof guestSchema>;
export type GuestFormValues = z.input<typeof guestSchema>;

export const createGuestSchema = guestSchema.extend({ eventId: z.uuid() });
export const updateGuestSchema = guestSchema.extend({
  eventId: z.uuid(),
  guestId: z.uuid(),
});
export const deleteGuestSchema = z.object({
  eventId: z.uuid(),
  guestId: z.uuid(),
});

export const householdSchema = z.object({
  eventId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  /** Gornja granica broja osoba na personalizovanom linku. */
  maxGuests: z
    .union([z.coerce.number().int().min(1).max(50), z.literal('')])
    .default(''),
  notes: z.string().trim().max(500).default(''),
});

export type HouseholdFormValues = z.input<typeof householdSchema>;

export const updateHouseholdSchema = householdSchema.extend({
  householdId: z.uuid(),
});

export const deleteHouseholdSchema = z.object({
  eventId: z.uuid(),
  householdId: z.uuid(),
});

/** Filteri liste gostiju; sve ide kroz URL da se stanje može podeliti linkom. */
export const guestFiltersSchema = z.object({
  pretraga: z.string().trim().max(80).optional(),
  oznaka: z.string().trim().max(40).optional(),
  odgovor: z.enum(['svi', 'pending', 'yes', 'no', 'maybe']).default('svi'),
  redosled: z.enum(['ime', 'prezime', 'najnoviji']).default('prezime'),
});

export type GuestFilters = z.infer<typeof guestFiltersSchema>;

// --- Personalizovani linkovi ------------------------------------------------

export const createRecipientSchema = z.object({
  eventId: z.uuid(),
  /** Tačno jedno od ovo dvoje; proverava server. */
  guestId: z.union([z.uuid(), z.literal('')]).default(''),
  householdId: z.union([z.uuid(), z.literal('')]).default(''),
});

export const revokeRecipientSchema = z.object({
  eventId: z.uuid(),
  recipientId: z.uuid(),
});

// --- Uvoz ------------------------------------------------------------------

export const importGuestsSchema = z.object({
  eventId: z.uuid(),
  /** Sadržaj CSV fajla; parsira se i validira na serveru. */
  csv: z.string().min(1).max(2_000_000),
  /** Da li prvi red sadrži nazive kolona. */
  hasHeader: z.boolean().default(true),
});
