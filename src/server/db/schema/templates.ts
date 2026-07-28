import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { ThemeTokens } from '@/features/themes/tokens';

import { primaryId, timestamps } from './_shared';
import { users } from './auth';
import { eventTypes } from './events';
import { templateStatusEnum } from './enums';

/**
 * Tema kao samostalan entitet.
 *
 * Odvojena je od šablona da bi ista paleta i tipografija mogle da se dele
 * između više šablona, a administrator da je uređuje na jednom mestu.
 */
export const themes = pgTable(
  'themes',
  {
    id: primaryId,
    key: text('key').notNull(),
    name: text('name').notNull(),
    tokens: jsonb('tokens').$type<ThemeTokens>().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('themes_key_unique').on(table.key)],
);

/**
 * Šablon je "proizvod" u galeriji; konkretan sadržaj nosi `template_versions`.
 *
 * Ova podela je ključna za zahtev 19/39.3: izmena šablona ne sme da promeni već
 * napravljene pozivnice, pa pozivnica pamti *verziju*, a ne šablon.
 */
export const templates = pgTable(
  'templates',
  {
    id: primaryId,
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    eventTypeId: uuid('event_type_id')
      .notNull()
      .references(() => eventTypes.id, { onDelete: 'restrict' }),

    /** Filteri u galeriji (zahtev 7, korak 3). */
    style: text('style').notNull().default('minimal'),
    dominantColor: text('dominant_color').notNull().default('#faf8f5'),
    usesPhotos: boolean('uses_photos').notNull().default(true),

    status: templateStatusEnum('status').notNull().default('draft'),
    isFeatured: boolean('is_featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),

    /** Minimalni paket u kom je šablon dostupan (`free`, `standard`, `premium`). */
    requiredPlanCode: text('required_plan_code').notNull().default('free'),

    coverImageUrl: text('cover_image_url'),
    /** Aktuelna objavljena verzija; nove pozivnice kreću od nje. */
    publishedVersionId: uuid('published_version_id'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('templates_slug_unique').on(table.slug),
    index('templates_gallery_idx').on(
      table.status,
      table.eventTypeId,
      table.sortOrder,
    ),
    index('templates_featured_idx').on(table.isFeatured),
  ],
);

/**
 * Verzija šablona: tema + početne sekcije + demo sadržaj.
 *
 * `sections` je JSONB jer je to nepromenljiv snimak koji se kopira u pozivnicu;
 * nikad se ne pretražuje po pojedinačnoj sekciji šablona.
 */
export const templateVersions = pgTable(
  'template_versions',
  {
    id: primaryId,
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    status: templateStatusEnum('status').notNull().default('draft'),

    themeId: uuid('theme_id').references(() => themes.id, {
      onDelete: 'set null',
    }),
    /** Snimak tokena teme - šablon ostaje ispravan i ako se tema kasnije obriše. */
    themeTokens: jsonb('theme_tokens').$type<ThemeTokens>().notNull(),

    sections: jsonb('sections')
      .$type<
        Array<{
          type: string;
          schemaVersion: number;
          position: number;
          isVisible: boolean;
          data: unknown;
        }>
      >()
      .notNull()
      .default([]),

    /** Demo podaci za javnu demo stranicu šablona (`/demo/[slug]`). */
    demoContext: jsonb('demo_context').$type<Record<string, unknown>>(),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('template_versions_template_version_unique').on(
      table.templateId,
      table.version,
    ),
    index('template_versions_status_idx').on(table.templateId, table.status),
  ],
);

export const templatesRelations = relations(templates, ({ one, many }) => ({
  eventType: one(eventTypes, {
    fields: [templates.eventTypeId],
    references: [eventTypes.id],
  }),
  versions: many(templateVersions),
  publishedVersion: one(templateVersions, {
    fields: [templates.publishedVersionId],
    references: [templateVersions.id],
  }),
}));

export const templateVersionsRelations = relations(
  templateVersions,
  ({ one }) => ({
    template: one(templates, {
      fields: [templateVersions.templateId],
      references: [templates.id],
    }),
    theme: one(themes, {
      fields: [templateVersions.themeId],
      references: [themes.id],
    }),
  }),
);
