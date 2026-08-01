import { z } from 'zod';

import { LOCALES, type Locale } from '@/i18n/config';

/**
 * HTML šabloni: druga vrsta šablona (zahtev 7 i 39.2).
 *
 * Postojeći šabloni su **sekcije** - strukturirani podaci koje renderuje registar
 * sekcija. HTML šablon je nešto sasvim drugo: gotov, ručno pravljen jednostrani
 * sajt sa sopstvenim animacijama, koji se ne prevodi u sekcije. Prevođenje bi
 * uništilo baš ono zbog čega takav šablon i postoji.
 *
 * Zbog toga HTML šablon ima **polja** umesto sekcija: organizator popunjava
 * imena, datume i tekstove, a raspored i animacije ostaju onakvi kakvim ih je
 * autor napravio.
 *
 * Ovaj modul je ugovor koji dele tri strane:
 *
 * 1. **uvoznik** (CLI) - proverava `template.json` pre nego što išta upiše,
 * 2. **uređivač** - iz definicija polja pravi formu,
 * 3. **javni prikaz** - vrednostima polja popunjava HTML.
 *
 * Zato ovde nema ničega serverskog: iste šeme rade i u pregledaču.
 */

/** Tipovi polja koje organizator popunjava. */
export const HTML_FIELD_TYPES = [
  'text',
  'longtext',
  'date',
  'time',
  'place',
  'image',
  'url',
] as const;

export type HtmlFieldType = (typeof HTML_FIELD_TYPES)[number];

/**
 * Tekst na sva četiri jezika platforme.
 *
 * Srpski (latinica) je obavezan jer je izvorni jezik projekta; ostali su
 * neobavezni da uvoznik ne bi odbio manifest zbog prevoda koji tek treba da se
 * dopiše. Prikaz pada na `sr-Latn` kada prevod nedostaje - isto pravilo kao u
 * glavnom katalogu.
 */
export const localizedTextSchema = z
  .object({
    'sr-Latn': z.string().min(1, 'Srpski (latinica) je obavezan.'),
    'sr-Cyrl': z.string().optional(),
    en: z.string().optional(),
    de: z.string().optional(),
  })
  .strict();

export type LocalizedText = z.infer<typeof localizedTextSchema>;

export function localized(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text['sr-Latn'];
}

/**
 * Gde u dokumentu vrednost polja završava.
 *
 * Tri mesta, jer se u pravim sajtovima sadržaj nalazi na sva tri:
 *
 * - `text` - tekst elementa (`<h1 data-field="imeMlade">`),
 * - `attr` - vrednost atributa (`src`, `href`, `datetime`, `content`),
 * - `script` - token `{{kljuc}}` unutar JS fajla (odbrojavanje, mapa koordinata).
 *
 * Svako od njih ima **svoj** način bekstvovanja pri renderovanju; zbog toga se
 * i pamti kao podatak, a ne pogađa iz konteksta.
 */
export const fieldBindingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), selector: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal('attr'),
      selector: z.string().min(1),
      attr: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('script'),
      /** Fajl u kom se token nalazi, relativno na koren šablona. */
      file: z.string().min(1),
      token: z.string().min(1),
    })
    .strict(),
]);

export type FieldBinding = z.infer<typeof fieldBindingSchema>;

/**
 * Ključ polja.
 *
 * Ulazi u `data-field` atribut i u `{{token}}`, pa je namerno uzak: slova,
 * cifre i crtice. Time se izbegava i pitanje bekstvovanja samog ključa.
 */
export const fieldKeySchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Ključ sme da ima samo slova, cifre, - i _.');

export const htmlFieldSchema = z
  .object({
    key: fieldKeySchema,
    type: z.enum(HTML_FIELD_TYPES),
    /** Grupa u formi uređivača; mora da postoji u `groups`. */
    group: z.string().min(1),
    label: localizedTextSchema,
    help: localizedTextSchema.optional(),
    required: z.boolean().default(false),
    /**
     * Vrednost iz originalnog sajta.
     *
     * Ona je ujedno i sadržaj demo prikaza, pa šablon u galeriji izgleda tačno
     * onako kako ga je autor napravio.
     */
    default: z.string().default(''),
    maxLength: z.number().int().min(1).max(10_000).optional(),
    bind: z.array(fieldBindingSchema).min(1, 'Polje mora negde da se prikaže.'),
  })
  .strict();

export type HtmlField = z.infer<typeof htmlFieldSchema>;

export const fieldGroupSchema = z
  .object({
    key: z.string().min(1),
    label: localizedTextSchema,
  })
  .strict();

export type FieldGroup = z.infer<typeof fieldGroupSchema>;

/**
 * Definicije polja jednog HTML šablona.
 *
 * Čuvaju se dvaput: u verziji šablona (izvor) i u pozivnici (snimak, kao što se
 * i sekcije kopiraju pri kreiranju). Kasnija izmena šablona zato ne menja
 * pozivnicu koja je već napravljena - isto pravilo koje već važi za sekcije
 * (zahtev 39.2).
 */
export const fieldDefinitionsSchema = z
  .object({
    groups: z.array(fieldGroupSchema).min(1),
    fields: z.array(htmlFieldSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    const groupKeys = new Set(value.groups.map((group) => group.key));
    const seen = new Set<string>();

    for (const [index, field] of value.fields.entries()) {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', index, 'key'],
          message: `Ključ „${field.key}” se ponavlja.`,
        });
      }
      seen.add(field.key);

      if (!groupKeys.has(field.group)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', index, 'group'],
          message: `Grupa „${field.group}” ne postoji u spisku grupa.`,
        });
      }
    }
  });

export type FieldDefinitions = z.infer<typeof fieldDefinitionsSchema>;

/**
 * Vrednosti polja jedne pozivnice.
 *
 * Namerno `record` stringova, a ne šema izvedena iz definicija: definicije
 * dolaze iz baze i menjaju se po šablonu, pa se provera tipa i obaveznosti radi
 * u odnosu na njih (`validateFieldValues`), a ne kroz statički tip.
 */
export const fieldValuesSchema = z.record(fieldKeySchema, z.string());

export type FieldValues = z.infer<typeof fieldValuesSchema>;

/** Asset šablona; putanja je relativna na koren uvezenog sajta. */
export const templateAssetSchema = z
  .object({
    path: z.string().min(1),
    storageKey: z.string().min(1),
    contentType: z.string().min(1),
    bytes: z.number().int().min(0),
  })
  .strict();

export type TemplateAsset = z.infer<typeof templateAssetSchema>;

export const templateAssetsSchema = z.array(templateAssetSchema);

/**
 * Provera vrednosti u odnosu na definicije.
 *
 * Vraća greške po ključu polja, u istom obliku koji forme već koriste
 * (`fieldErrors`), pa se poruke prikazuju uz samo polje. Nepoznati ključevi se
 * **odbacuju**, a ne prijavljuju kao greška: posle promene šablona u vrednostima
 * ostaju ključevi kojih više nema, i to nije korisnikova greška.
 */
export function validateFieldValues(
  definitions: FieldDefinitions,
  values: FieldValues,
): { values: FieldValues; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  const clean: FieldValues = {};

  for (const field of definitions.fields) {
    const raw = values[field.key] ?? '';
    const value = raw.trim();

    if (field.required && value === '') {
      errors[field.key] = ['Ovo polje je obavezno.'];
      continue;
    }

    if (value === '') {
      clean[field.key] = '';
      continue;
    }

    const problem = checkFieldValue(field, value);
    if (problem) {
      errors[field.key] = [problem];
      continue;
    }

    clean[field.key] = value;
  }

  return { values: clean, errors };
}

function checkFieldValue(field: HtmlField, value: string): string | null {
  if (field.maxLength && value.length > field.maxLength) {
    return `Najviše ${field.maxLength} znakova.`;
  }

  switch (field.type) {
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : 'Unesite datum u obliku GGGG-MM-DD.';
    case 'time':
      return /^\d{2}:\d{2}$/.test(value) ? null : 'Unesite vreme u obliku HH:MM.';
    case 'url':
      // Isto pravilo kao `safeUrlSchema` sekcija: samo http(s), nikad `javascript:`.
      return /^https?:\/\/\S+$/i.test(value) ? null : 'Unesite link koji počinje sa http(s)://.';
    case 'image':
      // Slika je ili ključ otpremljene fotografije ili asset iz samog šablona.
      return value.length <= 500 ? null : 'Putanja do slike je predugačka.';
    default:
      return null;
  }
}

/** Podrazumevane vrednosti iz definicija - početno stanje pozivnice i demo prikaza. */
export function defaultFieldValues(definitions: FieldDefinitions): FieldValues {
  return Object.fromEntries(
    definitions.fields.map((field) => [field.key, field.default]),
  );
}

/** Polja grupisana za prikaz u formi, redosledom iz manifesta. */
export function groupedFields(
  definitions: FieldDefinitions,
): Array<{ group: FieldGroup; fields: HtmlField[] }> {
  return definitions.groups
    .map((group) => ({
      group,
      fields: definitions.fields.filter((field) => field.group === group.key),
    }))
    .filter((entry) => entry.fields.length > 0);
}

/** Svi jezici platforme - koristi ga uvoznik pri popunjavanju praznih prevoda. */
export const SUPPORTED_LOCALES = LOCALES;
