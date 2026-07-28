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

import type { EventDetails } from '@/features/events/details';

import { primaryId, softDelete, timestamps } from './_shared';
import { users } from './auth';
import {
  collaboratorRoleEnum,
  collaboratorStatusEnum,
  eventStatusEnum,
  localeEnum,
} from './enums';

/**
 * Tipovi događaja su tabela, a ne enum: administrator mora da može da doda novu
 * vrstu proslave bez migracije (zahtev 5 i 19).
 */
export const eventTypes = pgTable(
  'event_types',
  {
    id: primaryId,
    /** Stabilan ključ koji kod koristi (`wedding`, `first_birthday`...). */
    key: text('key').notNull(),
    /** Slug za javne rute: /sabloni/vencanje */
    slug: text('slug').notNull(),
    /** Ključ prevoda naziva - naziv se nikad ne čuva na jednom jeziku. */
    labelKey: text('label_key').notNull(),
    icon: text('icon').notNull().default('sparkles'),
    /**
     * Koja polja wizard traži u drugom koraku. Oblik se validira Zod šemom u
     * `src/features/events/details.ts`, pa je JSONB ovde dovoljan.
     */
    detailFields: jsonb('detail_fields')
      .$type<string[]>()
      .notNull()
      .default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('event_types_key_unique').on(table.key),
    uniqueIndex('event_types_slug_unique').on(table.slug),
    index('event_types_active_idx').on(table.isActive, table.sortOrder),
  ],
);

export const events = pgTable(
  'events',
  {
    id: primaryId,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventTypeId: uuid('event_type_id')
      .notNull()
      .references(() => eventTypes.id, { onDelete: 'restrict' }),

    /** Interni naziv koji vidi samo organizator. */
    name: text('name').notNull(),
    status: eventStatusEnum('status').notNull().default('draft'),

    /**
     * Podaci specifični za tip događaja (imena mladenaca, ime deteta...).
     * Normalizovati ih nema smisla jer se skup polja razlikuje po tipu i menja
     * kroz administraciju; ono po čemu se pretražuje (datum, grad) izdvojeno je
     * u zasebne kolone.
     */
    details: jsonb('details').$type<EventDetails>().notNull().default({}),

    /** Datum i vreme početka; uvek `timestamptz` + eksplicitna zona. */
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    timeZone: text('time_zone').notNull().default('Europe/Belgrade'),

    city: text('city'),
    venueName: text('venue_name'),

    /** Jezik pozivnice; može se razlikovati od jezika interfejsa. */
    primaryLocale: localeEnum('primary_locale').notNull().default('sr-Latn'),
    secondaryLocale: localeEnum('secondary_locale'),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('events_owner_idx').on(table.ownerId, table.createdAt),
    index('events_type_idx').on(table.eventTypeId),
    index('events_starts_at_idx').on(table.startsAt),
  ],
);

/**
 * Saradnici (zahtev 5).
 *
 * Poziv se šalje na email i pre nego što nalog postoji, pa je `userId` opcion
 * dok saradnik ne prihvati poziv.
 */
export const eventCollaborators = pgTable(
  'event_collaborators',
  {
    id: primaryId,
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: collaboratorRoleEnum('role').notNull().default('editor'),
    status: collaboratorStatusEnum('status').notNull().default('pending'),
    /** Heš tokena iz pozivnog linka - sam token se čuva samo u mejlu. */
    inviteTokenHash: text('invite_token_hash'),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    invitedById: uuid('invited_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // Ista osoba ne može dvaput biti saradnik na istom događaju.
    uniqueIndex('event_collaborators_event_email_unique').on(
      table.eventId,
      table.email,
    ),
    index('event_collaborators_user_idx').on(table.userId),
    uniqueIndex('event_collaborators_invite_token_unique').on(
      table.inviteTokenHash,
    ),
  ],
);

export const eventsRelations = relations(events, ({ one, many }) => ({
  owner: one(users, { fields: [events.ownerId], references: [users.id] }),
  eventType: one(eventTypes, {
    fields: [events.eventTypeId],
    references: [eventTypes.id],
  }),
  collaborators: many(eventCollaborators),
}));

export const eventCollaboratorsRelations = relations(
  eventCollaborators,
  ({ one }) => ({
    event: one(events, {
      fields: [eventCollaborators.eventId],
      references: [events.id],
    }),
    user: one(users, {
      fields: [eventCollaborators.userId],
      references: [users.id],
    }),
  }),
);

export const eventTypesRelations = relations(eventTypes, ({ many }) => ({
  events: many(events),
}));
