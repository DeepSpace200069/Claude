import { z } from 'zod';

import { LOCALES } from '@/i18n/config';

import { eventDetailsSchema } from './details';

/**
 * Šeme formi za događaje.
 *
 * Ista šema se koristi na klijentu (React Hook Form) i na serveru (server
 * akcija), pa validacija ne može da se zaobiđe isključivanjem JavaScripta
 * (zahtev 24).
 */
const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Nepoznata vremenska zona.');

/** Datum i vreme iz formulara stižu odvojeno jer su i polja odvojena. */
const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Unesite ispravan datum.')
  .optional()
  .or(z.literal(''));

const timeInput = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Unesite vreme u formatu ČČ:MM.')
  .optional()
  .or(z.literal(''));

export const createEventSchema = z.object({
  eventTypeId: z.uuid('Izaberite vrstu proslave.'),
  name: z
    .string()
    .trim()
    .min(2, 'Unesite najmanje 2 znaka.')
    .max(120, 'Dozvoljeno je najviše 120 znakova.'),
  details: eventDetailsSchema.default({}),
  date: dateInput,
  time: timeInput,
  timeZone: timeZoneSchema.default('Europe/Belgrade'),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  venueName: z.string().trim().max(160).optional().or(z.literal('')),
  primaryLocale: z.enum(LOCALES).default('sr-Latn'),
  templateId: z.uuid().optional(),
});

/**
 * Ulaz i izlaz šeme nisu isti tip: polja sa `default()` su na ulazu opciona, a
 * na izlazu popunjena. Forme koriste ulazni tip, a server akcije izlazni.
 */
export type CreateEventFormValues = z.input<typeof createEventSchema>;
export type CreateEventInput = z.output<typeof createEventSchema>;

export const updateEventSchema = createEventSchema
  .omit({ eventTypeId: true, templateId: true })
  .extend({
    id: z.uuid(),
    secondaryLocale: z.enum(LOCALES).nullable().default(null),
  });

export type UpdateEventFormValues = z.input<typeof updateEventSchema>;
export type UpdateEventInput = z.output<typeof updateEventSchema>;

export const deleteEventSchema = z.object({
  id: z.uuid(),
  /** Korisnik mora da otkuca naziv događaja - potvrda za destruktivnu radnju. */
  confirmation: z.string().trim().min(1),
});

/**
 * Spaja datum, vreme i zonu u apsolutni trenutak.
 *
 * Datum se u bazi čuva kao `timestamptz`, pa vreme mora da bude interpretirano
 * u zoni događaja, a ne u zoni servera - inače bi venčanje u 17h u Beogradu
 * gostu u Beču bilo prikazano pogrešno.
 */
export function toInstant(
  date: string | undefined,
  time: string | undefined,
  timeZone: string,
): Date | null {
  if (!date) return null;

  const [hours, minutes] = (time && time.length > 0 ? time : '00:00')
    .split(':')
    .map(Number);

  // Polazimo od UTC pretpostavke, pa korigujemo za pomeraj zone u tom trenutku.
  const naiveUtc = Date.parse(
    `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`,
  );
  if (Number.isNaN(naiveUtc)) return null;

  const offsetMs = timeZoneOffsetMs(new Date(naiveUtc), timeZone);
  return new Date(naiveUtc - offsetMs);
}

/** Pomeraj zone u milisekundama za dati trenutak (uključuje letnje računanje). */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - instant.getTime();
}

/** Razlaže sačuvan trenutak nazad u polja formulara. */
export function fromInstant(
  instant: Date | null,
  timeZone: string,
): { date: string; time: string } {
  if (!instant) return { date: '', time: '' };

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // `sv-SE` daje ISO-sličan zapis "2026-05-30 17:00".
  const [date = '', time = ''] = formatter.format(instant).split(' ');
  return { date, time: time.slice(0, 5) };
}
