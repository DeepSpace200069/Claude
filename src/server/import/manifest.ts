import { z } from 'zod';

import { fieldDefinitionsSchema } from '@/features/templates/html-schema';

/**
 * `template.json` - uputstvo za uvoz jednog gotovog sajta (zahtev 39.3).
 *
 * Uvoz ide u dva prolaza. Prvi (`--analiza`) pročita folder i **predloži** ovaj
 * fajl: šta je našao kao spoljni resurs, gde je ukrasna RSVP forma, koje mape
 * treba zameniti i koja bi polja organizator popunjavao. Drugi prolaz čita
 * fajl onakav kakav ga je operator ostavio i tek tada dira bazu.
 *
 * Podela postoji zato što nijedna heuristika ne pogađa šta je u tuđem sajtu
 * „ime mlade”, a šta ukras. Predlog je početna tačka koju čovek ispravi; ono
 * što je upisano u `template.json` je jedina istina za uvoz.
 *
 * Ceo fajl je `strict`: nepoznat ključ je greška, a ne tiho zanemarena opcija.
 * Pogrešno otkucano `usesPhotos` ne sme da prođe kao „podrazumevano”.
 */

/** Slug šablona; ujedno i ključ po kom je uvoz idempotentan. */
export const templateSlugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug sme da ima samo mala slova, cifre i crtice.');

/**
 * Spoljni resurs koji se preuzima i servira sa našeg domena.
 *
 * `url` je odakle se preuzima **pri uvozu**, `path` je gde fajl živi unutar
 * šablona posle uvoza. Posle uvoza `url` više nikoga ne zanima - u dokumentu
 * ostaje samo `path` (zahtev: nikakav sadržaj sa spoljnih domena u runtime-u).
 */
export const vendoredResourceSchema = z
  .object({
    url: z.string().url(),
    path: z
      .string()
      .min(1)
      .regex(
        /^(?!\/)(?!.*\.\.)[\w./-]+$/,
        'Putanja mora da bude relativna, bez `..` i bez neobičnih znakova.',
      ),
  })
  .strict();

export type VendoredResource = z.infer<typeof vendoredResourceSchema>;

/**
 * Zamena ugrađene mape karticom lokacije.
 *
 * `<iframe>` ka Google mapama pada na našoj CSP politici, a i pre toga odaje IP
 * adresu gosta pre bilo kakvog pristanka. Zato se svaka mapa zamenjuje običnim
 * linkom sa nazivom i adresom - zahtev ide u mapu tek kad gost klikne.
 *
 * Naziv, adresa i link su **polja**, pa organizator menja lokaciju bez
 * ponovnog uvoza šablona.
 */
export const mapCardSchema = z
  .object({
    /** CSS selektor elementa koji se uklanja (obično `iframe`). */
    selector: z.string().min(1),
    nameField: z.string().min(1),
    addressField: z.string().min(1),
    urlField: z.string().min(1),
    /**
     * Natpis na dugmetu.
     *
     * Podatak, a ne prevod u kodu: uvezen sajt je napisan na jednom jeziku i
     * kartica mora da govori tim istim jezikom, bez obzira na jezik interfejsa.
     */
    label: z.string().min(1).default('Otvori u mapama'),
  })
  .strict();

export type MapCard = z.infer<typeof mapCardSchema>;

export const importManifestSchema = z
  .object({
    /** Beleška operatora; uvoz je ne koristi. Prvi prolaz je popuni uputstvom. */
    note: z.string().max(1000).optional(),

    slug: templateSlugSchema,
    name: z.string().min(2).max(120),
    description: z.string().max(600).default(''),

    /** Slug tipa događaja iz kataloga (`vencanje`, `krstenje`...). */
    eventType: z.string().min(1),
    style: z.string().min(1).default('elegant'),
    dominantColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Boja mora da bude u obliku #rrggbb.')
      .default('#111111'),
    usesPhotos: z.boolean().default(true),
    requiredPlan: z.enum(['free', 'standard', 'premium']).default('premium'),
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().default(0),

    /** Ulazni HTML fajl unutar foldera. */
    entry: z.string().min(1).default('index.html'),

    vendor: z.array(vendoredResourceSchema).default([]),

    /**
     * Ukrasna RSVP forma iz šablona.
     *
     * Uklanja se i na njeno mesto ide prava forma platforme. `null` znači da je
     * šablon nema, pa se mesto dodaje na kraj tela.
     */
    rsvp: z.object({ selector: z.string().min(1) }).strict().nullable().default(null),

    maps: z.array(mapCardSchema).default([]),

    /**
     * Šta se izbacuje iz dokumenta pre svega ostalog.
     *
     * Postoji zbog analitike, „powered by” traka i sličnog što autor sajta
     * ostavi, a što u pozivnici nema šta da traži.
     */
    strip: z.array(z.string().min(1)).default([]),

    /** Forma koju organizator popunjava; isti oblik koji ide u bazu. */
    form: fieldDefinitionsSchema,
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const keys = new Set(manifest.form.fields.map((field) => field.key));
    const cardNames = new Set<string>();

    for (const [index, map] of manifest.maps.entries()) {
      // `nameField` je i identifikator kartice u dokumentu (`data-mapa`).
      if (cardNames.has(map.nameField)) {
        ctx.addIssue({
          code: 'custom',
          path: ['maps', index, 'nameField'],
          message: `Dve mape ne mogu da dele polje „${map.nameField}”.`,
        });
      }
      cardNames.add(map.nameField);

      for (const name of ['nameField', 'addressField', 'urlField'] as const) {
        if (!keys.has(map[name])) {
          ctx.addIssue({
            code: 'custom',
            path: ['maps', index, name],
            message: `Polje „${map[name]}” ne postoji u „form.fields”.`,
          });
        }
      }
    }

    const paths = new Set<string>();
    for (const [index, resource] of manifest.vendor.entries()) {
      if (paths.has(resource.path)) {
        ctx.addIssue({
          code: 'custom',
          path: ['vendor', index, 'path'],
          message: `Putanja „${resource.path}” se ponavlja.`,
        });
      }
      paths.add(resource.path);
    }
  });

export type ImportManifest = z.infer<typeof importManifestSchema>;

/** Čitanje `template.json` sa porukom koja kaže gde je greška. */
export function parseManifest(raw: unknown): ImportManifest {
  const result = importManifestSchema.safeParse(raw);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(koren)'}: ${issue.message}`)
    .join('\n');

  throw new Error(`template.json nije ispravan:\n${details}`);
}
