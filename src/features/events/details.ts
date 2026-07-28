import { z } from 'zod';

/**
 * Polja drugog koraka čarobnjaka (zahtev 7).
 *
 * Skup polja zavisi od tipa događaja, ali su sva polja opciona na nivou
 * skladištenja: korisnik može da sačuva nacrt sa nepotpunim podacima, a
 * obaveznost se proverava tek pri objavljivanju pozivnice.
 */

/** Sva polja koja neki tip događaja može da traži. */
export const DETAIL_FIELDS = [
  'partner1Name',
  'partner2Name',
  'celebrantName',
  'childName',
  'parentNames',
  'birthDate',
  'turningAge',
  'hostNames',
  'note',
] as const;

export type DetailField = (typeof DETAIL_FIELDS)[number];

const nameSchema = z.string().trim().min(1).max(80);

/** ISO datum bez vremena (`YYYY-MM-DD`) - datum rođenja nije trenutak u vremenu. */
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Očekivan je datum u formatu GGGG-MM-DD.');

export const eventDetailsSchema = z
  .object({
    partner1Name: nameSchema.optional(),
    partner2Name: nameSchema.optional(),
    celebrantName: nameSchema.optional(),
    childName: nameSchema.optional(),
    parentNames: z.string().trim().max(160).optional(),
    birthDate: isoDateSchema.optional(),
    turningAge: z.number().int().min(1).max(120).optional(),
    hostNames: z.string().trim().max(160).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type EventDetails = z.infer<typeof eventDetailsSchema>;

/**
 * Koja polja se traže za koji tip događaja.
 *
 * Vrednost se upisuje u `event_types.detail_fields` pri seed-u, pa administrator
 * može da je promeni bez izmene koda; ova mapa je podrazumevana vrednost.
 */
export const DEFAULT_DETAIL_FIELDS: Record<string, DetailField[]> = {
  wedding: ['partner1Name', 'partner2Name'],
  wedding_christening: ['partner1Name', 'partner2Name', 'childName'],
  christening: ['childName', 'parentNames'],
  first_birthday: ['childName', 'birthDate', 'parentNames'],
  birthday: ['celebrantName', 'turningAge'],
  coming_of_age: ['celebrantName', 'birthDate'],
  other: ['hostNames', 'note'],
};

/**
 * Predlog naslova pozivnice na osnovu unetih podataka.
 *
 * Koristi se kao podrazumevana vrednost - korisnik ga uvek može promeniti.
 */
export function suggestEventName(
  eventTypeKey: string,
  details: EventDetails,
  fallback: string,
): string {
  const both = (a?: string, b?: string) =>
    a && b ? `${a} i ${b}` : (a ?? b ?? '');

  switch (eventTypeKey) {
    case 'wedding':
    case 'wedding_christening': {
      const names = both(details.partner1Name, details.partner2Name);
      return names || fallback;
    }
    case 'christening':
    case 'first_birthday':
      return details.childName || fallback;
    case 'birthday':
    case 'coming_of_age':
      return details.celebrantName || fallback;
    default:
      return details.hostNames || fallback;
  }
}

/**
 * Provera da li su podaci dovoljni za objavljivanje.
 *
 * Namerno je odvojena od šeme čuvanja: nacrt sme da bude nepotpun, objavljena
 * pozivnica ne sme.
 */
export function missingRequiredDetails(
  requiredFields: readonly string[],
  details: EventDetails,
): string[] {
  return requiredFields.filter((field) => {
    const value = details[field as DetailField];
    return value === undefined || value === null || value === '';
  });
}
