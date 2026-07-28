import { z } from 'zod';

import { defineSection } from '../types';
import {
  coordinatesSchema,
  emailSchema,
  headingSchema,
  iconSchema,
  mediaRefSchema,
  paragraphSchema,
  phoneSchema,
  safeUrlSchema,
  timeSchema,
} from '../shared-schemas';

/** Sekcije koje odgovaraju na pitanja „gde”, „kada” i „kako” (zahtev 9). */

// --- Lokacije ---------------------------------------------------------------

const locationSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(200).default(''),
  description: paragraphSchema.default(''),
  icon: iconSchema.default('map-pin'),

  /** Vreme na konkretnoj lokaciji (polazak iz doma, venčanje, restoran…). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  time: timeSchema.nullable().default(null),

  coordinates: coordinatesSchema.nullable().default(null),
  /**
   * Linkovi ka mapama se čuvaju odvojeno umesto da se generišu iz koordinata:
   * organizator često ima tačan link na konkretan objekat, precizniji od
   * koordinata koje bismo mi izračunali.
   */
  googleMapsUrl: safeUrlSchema.nullable().default(null),
  appleMapsUrl: safeUrlSchema.nullable().default(null),
  showMap: z.boolean().default(false),

  parkingNote: z.string().trim().max(300).default(''),
  accessibilityNote: z.string().trim().max(300).default(''),
  contactPhone: phoneSchema.or(z.literal('')).default(''),
  contactEmail: emailSchema.or(z.literal('')).default(''),
});

export type InvitationLocation = z.infer<typeof locationSchema>;

const locationsSchema = z.object({
  title: headingSchema.default(''),
  intro: paragraphSchema.default(''),
  layout: z.enum(['cards', 'list', 'timeline']).default('cards'),
  locations: z.array(locationSchema).max(10).default([]),
});

export const locationsSection = defineSection({
  type: 'locations',
  version: 1,
  labelKey: 'sections.locations.label',
  descriptionKey: 'sections.locations.description',
  icon: 'map-pin',
  category: 'logistics',
  schema: locationsSchema,
  allowedEventTypes: null,
  getDefaultData: () => locationsSchema.parse({}),
});

// --- Satnica ----------------------------------------------------------------

const scheduleItemSchema = z.object({
  id: z.string().min(1).max(40),
  time: timeSchema.nullable().default(null),
  title: z.string().trim().min(1).max(120),
  description: paragraphSchema.default(''),
  /** Veza ka lokaciji iz sekcije lokacija; slobodan tekst je fallback. */
  locationRef: z.string().max(40).default(''),
  locationLabel: z.string().trim().max(120).default(''),
  icon: iconSchema.default('clock'),
  image: mediaRefSchema.nullable().default(null),
});

const scheduleSchema = z.object({
  title: headingSchema.default(''),
  intro: paragraphSchema.default(''),
  style: z.enum(['timeline', 'list', 'cards']).default('timeline'),
  items: z.array(scheduleItemSchema).max(24).default([]),
});

export const scheduleSection = defineSection({
  type: 'schedule',
  version: 1,
  labelKey: 'sections.schedule.label',
  descriptionKey: 'sections.schedule.description',
  icon: 'clock',
  category: 'logistics',
  schema: scheduleSchema,
  allowedEventTypes: null,
  getDefaultData: () => scheduleSchema.parse({}),
});

// --- Korisne informacije ----------------------------------------------------

const infoCardSchema = z.object({
  id: z.string().min(1).max(40),
  icon: iconSchema.default('sparkles'),
  title: z.string().trim().min(1).max(80),
  body: paragraphSchema.default(''),
  linkUrl: safeUrlSchema.nullable().default(null),
  linkLabel: z.string().trim().max(60).default(''),
});

const infoCardsSchema = z.object({
  title: headingSchema.default(''),
  intro: paragraphSchema.default(''),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  cards: z.array(infoCardSchema).max(12).default([]),
});

/**
 * Kartice koje organizator sam definiše: parking, smeštaj, dress code, pokloni,
 * deca, alergije… Namerno nije fiksiran skup - svaka proslava ima svoje teme.
 */
export const infoCardsSection = defineSection({
  type: 'info_cards',
  version: 1,
  labelKey: 'sections.infoCards.label',
  descriptionKey: 'sections.infoCards.description',
  icon: 'info',
  category: 'logistics',
  schema: infoCardsSchema,
  allowedEventTypes: null,
  getDefaultData: () => infoCardsSchema.parse({}),
});

// --- Važne osobe ------------------------------------------------------------

const personSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().max(60).default(''),
  note: z.string().trim().max(200).default(''),
  photo: mediaRefSchema.nullable().default(null),
});

const peopleSchema = z.object({
  title: headingSchema.default(''),
  intro: paragraphSchema.default(''),
  layout: z.enum(['grid', 'list', 'cards']).default('grid'),
  showPhotos: z.boolean().default(true),
  people: z.array(personSchema).max(24).default([]),
});

export const peopleSection = defineSection({
  type: 'people',
  version: 1,
  labelKey: 'sections.people.label',
  descriptionKey: 'sections.people.description',
  icon: 'users-round',
  category: 'logistics',
  schema: peopleSchema,
  allowedEventTypes: null,
  getDefaultData: () => peopleSchema.parse({}),
});
