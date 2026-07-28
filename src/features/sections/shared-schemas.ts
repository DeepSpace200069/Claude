import { z } from 'zod';

/**
 * Deljene šeme koje više tipova sekcija koristi.
 *
 * Cilj je da se pravila (dozvoljeni linkovi, obavezan alt tekst, granice
 * dužine) definišu jednom, pa da nova sekcija ne može slučajno da ih izostavi.
 */

/** Kratak naslov sekcije. */
export const headingSchema = z.string().trim().max(120);

/** Tekstualni pasus; gornja granica čuva i izgled i performanse. */
export const paragraphSchema = z.string().trim().max(2000);

/**
 * Link koji unosi korisnik.
 *
 * Dozvoljeni su isključivo `http` i `https`: `javascript:` i `data:` su klasičan
 * put za XSS, a `tel:`/`mailto:` imaju svoja polja (zahtev 9 i 24).
 */
export const safeUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Dozvoljeni su samo linkovi koji počinju sa http:// ili https://');

export const emailSchema = z.email().max(160);

/** Telefon u slobodnom formatu - normalizacija bi pokvarila lokalne zapise. */
export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+()\d\s./-]+$/, 'Telefon sme da sadrži samo cifre i znakove + ( ) - . /');

/** Vreme u formatu ČČ:MM. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Očekivano je vreme u formatu ČČ:MM.');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Očekivan je datum u formatu GGGG-MM-DD.');

/**
 * Referenca na fotografiju.
 *
 * Čuva se ID zapisa iz `media_assets`, a ne URL: tako promena storage
 * provajdera ili CDN domena ne zahteva prepisivanje sadržaja pozivnica.
 */
export const mediaRefSchema = z.object({
  assetId: z.uuid(),
  /** Alt tekst je deo modela jer je pristupačnost obavezna (zahtev 31). */
  alt: z.string().trim().max(180).default(''),
  focalX: z.number().min(0).max(100).default(50),
  focalY: z.number().min(0).max(100).default(50),
});

export type MediaRef = z.infer<typeof mediaRefSchema>;

/** Dugme sa kontrolisanim ponašanjem - korisnik ne može da ubaci svoj kod. */
export const buttonSchema = z.object({
  label: z.string().trim().min(1).max(60),
  url: safeUrlSchema,
  style: z.enum(['primary', 'secondary', 'link']).default('primary'),
});

/**
 * Bogat tekst sa ograničenim skupom oznaka.
 *
 * Namerno **nije** proizvoljan HTML (zahtev 9): čuvamo strukturu koju sami
 * renderujemo, pa nema šta da se sanitizuje u trenutku prikaza.
 */
export const richTextSchema = z.object({
  blocks: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('paragraph'), text: paragraphSchema }),
        z.object({
          kind: z.literal('heading'),
          level: z.union([z.literal(2), z.literal(3)]),
          text: headingSchema,
        }),
        z.object({
          kind: z.literal('list'),
          ordered: z.boolean().default(false),
          items: z.array(z.string().trim().max(300)).max(20),
        }),
        z.object({ kind: z.literal('quote'), text: paragraphSchema }),
      ]),
    )
    .max(30),
});

export type RichText = z.infer<typeof richTextSchema>;

/** Koordinate lokacije; opcione jer mnogi korisnici imaju samo adresu. */
export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Naziv ikone iz kontrolisanog skupa - ne dozvoljavamo proizvoljan string. */
export const iconSchema = z.enum([
  'church',
  'home',
  'building',
  'restaurant',
  'cake',
  'rings',
  'camera',
  'music',
  'car',
  'bed',
  'gift',
  'heart',
  'star',
  'clock',
  'map-pin',
  'baby',
  'balloon',
  'utensils',
  'glass',
  'sparkles',
]);

export type IconName = z.infer<typeof iconSchema>;
