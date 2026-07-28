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

import { primaryId, softDelete, timestamps } from './_shared';
import { users } from './auth';
import { events } from './events';
import { templates, templateVersions } from './templates';
import {
  invitationPrivacyEnum,
  invitationStatusEnum,
  mediaStatusEnum,
} from './enums';

/**
 * Pozivnica: javno lice događaja.
 *
 * Jedan događaj ima jednu pozivnicu u MVP-u, ali je modelovano kao zaseban
 * entitet jer se javni link, privatnost i naplata odnose na pozivnicu, a ne na
 * događaj (npr. kasnije: više jezičkih varijanti iste pozivnice).
 */
export const invitations = pgTable(
  'invitations',
  {
    id: primaryId,
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),

    /** Javni slug; stabilan je - izmena sadržaja ne menja link (zahtev 38). */
    publicSlug: text('public_slug').notNull(),
    status: invitationStatusEnum('status').notNull().default('draft'),

    title: text('title').notNull().default(''),
    /** Uvodni tekst koji se koristi i u OG opisu ako organizator ne zada svoj. */
    summary: text('summary').notNull().default(''),

    /**
     * Snimak izabrane verzije šablona (zahtev 39.2).
     * Kasnija izmena šablona ne dira ovu pozivnicu - migracija je eksplicitna.
     */
    templateId: uuid('template_id').references(() => templates.id, {
      onDelete: 'set null',
    }),
    templateVersionId: uuid('template_version_id').references(
      () => templateVersions.id,
      { onDelete: 'set null' },
    ),
    /** Tema pozivnice; kopija tokena iz verzije šablona + korisničke izmene. */
    themeTokens: jsonb('theme_tokens').$type<ThemeTokens>().notNull(),

    privacy: invitationPrivacyEnum('privacy').notNull().default('unlisted'),
    /** Heš PIN-a; sam PIN se nikad ne čuva u čitljivom obliku. */
    pinHash: text('pin_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    /** Podaci link preview kartice koje organizator bira (zahtev 16). */
    shareTitle: text('share_title'),
    shareDescription: text('share_description'),
    shareImageUrl: text('share_image_url'),

    /**
     * Broj revizije za detekciju konflikta pri autosave-u (zahtev 26).
     * Uvećava se pri svakom uspešnom čuvanju sadržaja.
     */
    revision: integer('revision').notNull().default(1),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    unpublishedAt: timestamp('unpublished_at', { withTimezone: true }),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    // Jedinstvenost sluga se oslanja na bazu, a ne na proveru u aplikaciji -
    // samo tako je rezervacija sluga bezbedna pri istovremenim zahtevima.
    uniqueIndex('invitations_public_slug_unique').on(table.publicSlug),
    uniqueIndex('invitations_event_unique').on(table.eventId),
    index('invitations_status_idx').on(table.status),
  ],
);

/**
 * Sekcije pozivnice.
 *
 * `data` je JSONB jer je oblik različit po tipu sekcije, ali sve po čemu se
 * pretražuje ili sortira je u zasebnim kolonama (zahtev 20): tip, verzija
 * šeme, redosled, vidljivost i ID pozivnice.
 */
export const invitationSections = pgTable(
  'invitation_sections',
  {
    id: primaryId,
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),

    type: text('type').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    position: integer('position').notNull(),
    isVisible: boolean('is_visible').notNull().default(true),

    data: jsonb('data').$type<unknown>().notNull(),

    ...timestamps,
  },
  (table) => [
    index('invitation_sections_invitation_position_idx').on(
      table.invitationId,
      table.position,
    ),
    index('invitation_sections_type_idx').on(table.type),
  ],
);

/**
 * Istorija značajnih revizija (zahtev 26).
 *
 * Čuva pun snimak sekcija i teme da bi vraćanje prethodne verzije bilo
 * pouzdano i nezavisno od trenutnog registra sekcija.
 */
export const invitationRevisions = pgTable(
  'invitation_revisions',
  {
    id: primaryId,
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    label: text('label'),
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
      .notNull(),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('invitation_revisions_unique').on(
      table.invitationId,
      table.revision,
    ),
  ],
);

/** Otpremljene fotografije (zahtev 9, galerija). */
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: primaryId,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, {
      onDelete: 'cascade',
    }),

    /** Ključ u storage-u; javni URL gradi storage adapter. */
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    /** Alternativni tekst je obavezan za pristupačnost, ali se unosi kasnije. */
    altText: text('alt_text'),
    /** Fokusna tačka za kadriranje (0-1 po obe ose). */
    focalX: integer('focal_x').notNull().default(50),
    focalY: integer('focal_y').notNull().default(50),
    /** Sitna base64 sličica za elegantno početno stanje (zahtev 22). */
    placeholder: text('placeholder'),

    status: mediaStatusEnum('status').notNull().default('pending'),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    uniqueIndex('media_assets_storage_key_unique').on(table.storageKey),
    index('media_assets_event_idx').on(table.eventId),
    index('media_assets_owner_idx').on(table.ownerId),
  ],
);

export const invitationsRelations = relations(invitations, ({ one, many }) => ({
  event: one(events, { fields: [invitations.eventId], references: [events.id] }),
  template: one(templates, {
    fields: [invitations.templateId],
    references: [templates.id],
  }),
  templateVersion: one(templateVersions, {
    fields: [invitations.templateVersionId],
    references: [templateVersions.id],
  }),
  sections: many(invitationSections),
  revisions: many(invitationRevisions),
}));

export const invitationSectionsRelations = relations(
  invitationSections,
  ({ one }) => ({
    invitation: one(invitations, {
      fields: [invitationSections.invitationId],
      references: [invitations.id],
    }),
  }),
);
