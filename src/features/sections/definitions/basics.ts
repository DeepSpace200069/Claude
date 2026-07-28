import { z } from 'zod';

import { defineSection } from '../types';
import {
  buttonSchema,
  headingSchema,
  mediaRefSchema,
  paragraphSchema,
  richTextSchema,
} from '../shared-schemas';

/**
 * Osnovne sekcije (zahtev 9).
 *
 * Definicije su grupisane po kategoriji umesto po fajlu za svaki tip: broj
 * sekcija raste, a svaka definicija je nekoliko desetina redova, pa je ovako
 * lakše uporediti srodne sekcije. Registar i dalje radi po `type` ključu, tako
 * da grupisanje nema nikakav uticaj na ponašanje.
 */

// --- Naslovna sekcija -------------------------------------------------------

const heroSchema = z.object({
  /** Nadnaslov („Pozivamo vas”). */
  eyebrow: z.string().trim().max(60).default(''),
  title: headingSchema.default(''),
  subtitle: z.string().trim().max(200).default(''),
  image: mediaRefSchema.nullable().default(null),
  layout: z
    .enum(['centered', 'split', 'full-bleed', 'framed'])
    .default('centered'),
  overlayOpacity: z.number().min(0).max(80).default(25),
  /** Uvodna animacija koju gost uvek može da preskoči (zahtev 22). */
  showIntroAnimation: z.boolean().default(true),
});

export const heroSection = defineSection({
  type: 'hero',
  version: 1,
  labelKey: 'sections.hero.label',
  descriptionKey: 'sections.hero.description',
  icon: 'image',
  category: 'basics',
  schema: heroSchema,
  singleton: true,
  allowedEventTypes: null,
  getDefaultData: () => heroSchema.parse({}),
});

// --- Imena slavljenika ------------------------------------------------------

const namesSchema = z.object({
  primaryName: z.string().trim().max(80).default(''),
  secondaryName: z.string().trim().max(80).default(''),
  /** Veznik između imena („i”, „&”, „and”). */
  connector: z.string().trim().max(8).default('i'),
  note: z.string().trim().max(160).default(''),
  alignment: z.enum(['left', 'center']).default('center'),
});

export const namesSection = defineSection({
  type: 'names',
  version: 1,
  labelKey: 'sections.names.label',
  descriptionKey: 'sections.names.description',
  icon: 'users',
  category: 'basics',
  schema: namesSchema,
  singleton: true,
  allowedEventTypes: null,
  getDefaultData: () => namesSchema.parse({}),
});

// --- Datum i vreme ----------------------------------------------------------

const dateTimeSchema = z.object({
  title: headingSchema.default(''),
  /**
   * Datum se ne duplira ovde - izvor istine je `events.starts_at`. Sekcija
   * bira samo kako se prikazuje, pa promena datuma događaja odmah važi svuda.
   */
  display: z.enum(['full', 'compact', 'stacked', 'elegant']).default('full'),
  showDayName: z.boolean().default(true),
  showTime: z.boolean().default(true),
  note: z.string().trim().max(200).default(''),
});

export const dateTimeSection = defineSection({
  type: 'date_time',
  version: 1,
  labelKey: 'sections.dateTime.label',
  descriptionKey: 'sections.dateTime.description',
  icon: 'calendar',
  category: 'basics',
  schema: dateTimeSchema,
  singleton: true,
  allowedEventTypes: null,
  getDefaultData: () => dateTimeSchema.parse({}),
});

// --- Odbrojavanje -----------------------------------------------------------

const countdownSchema = z.object({
  title: headingSchema.default(''),
  style: z.enum(['boxes', 'inline', 'minimal']).default('boxes'),
  /** Šta prikazati kada datum prođe. */
  afterEventText: z.string().trim().max(160).default(''),
  showSeconds: z.boolean().default(false),
});

export const countdownSection = defineSection({
  type: 'countdown',
  version: 1,
  labelKey: 'sections.countdown.label',
  descriptionKey: 'sections.countdown.description',
  icon: 'timer',
  category: 'basics',
  schema: countdownSchema,
  singleton: true,
  allowedEventTypes: null,
  getDefaultData: () => countdownSchema.parse({}),
});

// --- Poruka (uvodna i završna) ---------------------------------------------

const messageSchema = z.object({
  title: headingSchema.default(''),
  body: paragraphSchema.default(''),
  signature: z.string().trim().max(120).default(''),
  alignment: z.enum(['left', 'center']).default('center'),
  decoration: z.enum(['none', 'quote', 'ornament']).default('none'),
});

export const messageSection = defineSection({
  type: 'message',
  version: 1,
  labelKey: 'sections.message.label',
  descriptionKey: 'sections.message.description',
  icon: 'message-circle',
  category: 'basics',
  schema: messageSchema,
  allowedEventTypes: null,
  getDefaultData: () => messageSchema.parse({}),
});

// --- Dodavanje u kalendar ---------------------------------------------------

const calendarSchema = z.object({
  title: headingSchema.default(''),
  description: z.string().trim().max(300).default(''),
  /** Koje opcije prikazujemo; `ics` radi svuda, ostalo su prečice. */
  providers: z
    .array(z.enum(['ics', 'google', 'outlook']))
    .min(1)
    .default(['ics', 'google']),
});

export const calendarSection = defineSection({
  type: 'calendar',
  version: 1,
  labelKey: 'sections.calendar.label',
  descriptionKey: 'sections.calendar.description',
  icon: 'calendar-plus',
  category: 'basics',
  schema: calendarSchema,
  singleton: true,
  allowedEventTypes: null,
  getDefaultData: () => calendarSchema.parse({}),
});

// --- Kontakt organizatora ---------------------------------------------------

const contactSchema = z.object({
  title: headingSchema.default(''),
  note: z.string().trim().max(200).default(''),
  contacts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        role: z.string().trim().max(60).default(''),
        /**
         * Kontakt podaci se prikazuju samo kada ih organizator eksplicitno
         * unese - podrazumevano se ne izlažu (zahtev 23).
         */
        phone: z.string().trim().max(32).default(''),
        email: z.string().trim().max(160).default(''),
      }),
    )
    .max(6)
    .default([]),
});

export const contactSection = defineSection({
  type: 'contact',
  version: 1,
  labelKey: 'sections.contact.label',
  descriptionKey: 'sections.contact.description',
  icon: 'phone',
  category: 'basics',
  schema: contactSchema,
  allowedEventTypes: null,
  getDefaultData: () => contactSchema.parse({}),
});

// --- Podnožje ---------------------------------------------------------------

const footerSchema = z.object({
  text: z.string().trim().max(300).default(''),
  showBranding: z.boolean().default(true),
  button: buttonSchema.nullable().default(null),
});

export const footerSection = defineSection({
  type: 'footer',
  version: 1,
  labelKey: 'sections.footer.label',
  descriptionKey: 'sections.footer.description',
  icon: 'minus',
  category: 'basics',
  schema: footerSchema,
  singleton: true,
  allowedEventTypes: null,
  getDefaultData: () => footerSchema.parse({}),
});

// --- Prilagođeni sadržaj (bez proizvoljnog HTML-a) --------------------------

const customContentSchema = z.object({
  title: headingSchema.default(''),
  content: richTextSchema.default({ blocks: [] }),
  image: mediaRefSchema.nullable().default(null),
  button: buttonSchema.nullable().default(null),
});

/**
 * Zamena za „ubaci svoj HTML”.
 *
 * Korisnik dobija naslov, ograničen bogat tekst, fotografiju i jedno dugme sa
 * proverenim linkom - dovoljno za prilagođavanje, bez ijedne tačke u kojoj bi
 * proizvoljan HTML ili JavaScript ušao u javnu stranicu (zahtev 9).
 */
export const customContentSection = defineSection({
  type: 'custom_content',
  version: 1,
  labelKey: 'sections.customContent.label',
  descriptionKey: 'sections.customContent.description',
  icon: 'square-pen',
  category: 'basics',
  schema: customContentSchema,
  allowedEventTypes: null,
  getDefaultData: () => customContentSchema.parse({}),
});
