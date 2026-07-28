import { z } from 'zod';

import { defineSection } from '../types';
import {
  headingSchema,
  isoDateSchema,
  mediaRefSchema,
  paragraphSchema,
  safeUrlSchema,
} from '../shared-schemas';

/** Sekcije sa fotografijama, pričom i muzikom (zahtev 9). */

// --- Galerija ---------------------------------------------------------------

const gallerySchema = z.object({
  title: headingSchema.default(''),
  intro: paragraphSchema.default(''),
  layout: z.enum(['grid', 'masonry', 'carousel', 'strip']).default('grid'),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  aspectRatio: z.enum(['original', 'square', 'portrait', 'landscape']).default('square'),
  enableLightbox: z.boolean().default(true),
  /**
   * Broj fotografija se ne ograničava ovde nego kroz entitlement sistem
   * (`maxPhotos`), da limit paketa ne bi bio hardkodovan u sekciji - zahtev 39.9.
   */
  images: z.array(mediaRefSchema).max(200).default([]),
});

export const gallerySection = defineSection({
  type: 'gallery',
  version: 1,
  labelKey: 'sections.gallery.label',
  descriptionKey: 'sections.gallery.description',
  icon: 'images',
  category: 'media',
  schema: gallerySchema,
  allowedEventTypes: null,
  getDefaultData: () => gallerySchema.parse({}),
});

// --- Priča ------------------------------------------------------------------

const storyEntrySchema = z.object({
  id: z.string().min(1).max(40),
  /** Slobodna oznaka vremena („Leto 2019.”, „Šesti mesec”). */
  label: z.string().trim().max(60).default(''),
  date: isoDateSchema.nullable().default(null),
  title: z.string().trim().min(1).max(120),
  text: paragraphSchema.default(''),
  image: mediaRefSchema.nullable().default(null),
});

const storySchema = z.object({
  title: headingSchema.default(''),
  intro: paragraphSchema.default(''),
  style: z.enum(['timeline', 'alternating', 'cards']).default('alternating'),
  entries: z.array(storyEntrySchema).max(30).default([]),
});

/**
 * Ista sekcija pokriva „kako smo se upoznali” za venčanja i „prva godina” za
 * prvi rođendan: struktura je identična (niz trenutaka sa fotografijom), a
 * razliku pravi sadržaj koji šablon ponudi.
 */
export const storySection = defineSection({
  type: 'story',
  version: 1,
  labelKey: 'sections.story.label',
  descriptionKey: 'sections.story.description',
  icon: 'book-heart',
  category: 'story',
  schema: storySchema,
  requiresFeature: 'story',
  allowedEventTypes: null,
  getDefaultData: () => storySchema.parse({}),
});

// --- Muzika -----------------------------------------------------------------

const musicSchema = z.object({
  title: headingSchema.default(''),
  /** Numera iz platformske biblioteke ili sopstveni otpremljeni fajl. */
  source: z.enum(['library', 'upload', 'link']).default('library'),
  libraryTrackId: z.string().max(60).default(''),
  assetId: z.uuid().nullable().default(null),
  externalUrl: safeUrlSchema.nullable().default(null),

  /**
   * Autoplay je dozvoljen samo posle interakcije gosta i uz vidljivu kontrolu -
   * pregledači ga inače blokiraju, a i pristupačnost to nalaže (zahtev 9/22).
   */
  autoplayAfterInteraction: z.boolean().default(false),
  showControls: z.boolean().default(true),
  loop: z.boolean().default(true),
  volume: z.number().min(0).max(100).default(60),
});

export const musicSection = defineSection({
  type: 'music',
  version: 1,
  labelKey: 'sections.music.label',
  descriptionKey: 'sections.music.description',
  icon: 'music',
  category: 'media',
  schema: musicSchema,
  singleton: true,
  requiresFeature: 'music',
  allowedEventTypes: null,
  getDefaultData: () => musicSchema.parse({}),
});
