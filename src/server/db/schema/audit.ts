import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared';
import { users } from './auth';
import { events } from './events';
import { invitations } from './invitations';
import { activityKindEnum } from './enums';

/**
 * Audit log administrativnih i kritičnih radnji (zahtev 24).
 *
 * Piše se uvek na serveru, nikad iz klijentskog koda, i nema `updatedAt` -
 * zapisi se ne menjaju.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: primaryId,
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** Email aktera se pamti odvojeno da zapis ostane čitljiv i posle brisanja naloga. */
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    /** Tip i ID pogođenog entiteta (`invitation`, `user`, `template`...). */
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    /** Stanje pre i posle izmene za kritična polja. */
    changes: jsonb('changes').$type<Record<string, unknown>>(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_logs_actor_idx').on(table.actorId, table.createdAt),
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_action_idx').on(table.action, table.createdAt),
  ],
);

/**
 * Feed aktivnosti koji vidi organizator (zahtev 15).
 *
 * Odvojen je od `audit_logs` namerno: audit je tehnički i pravni trag, a ovo
 * je proizvodna funkcionalnost sa tekstom koji se prikazuje korisniku.
 */
export const activityEvents = pgTable(
  'activity_events',
  {
    id: primaryId,
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    invitationId: uuid('invitation_id').references(() => invitations.id, {
      onDelete: 'cascade',
    }),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    kind: activityKindEnum('kind').notNull(),
    /** Parametri za prevod poruke (ime gosta, broj osoba...). */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('activity_events_event_idx').on(table.eventId, table.createdAt),
  ],
);

/**
 * Dnevni agregat poseta javnoj pozivnici (zahtev 27).
 *
 * Čuvamo samo zbirne brojeve po danu - nikad pojedinačne posete, IP adrese ni
 * bilo šta što bi identifikovalo gosta.
 */
export const invitationViewStats = pgTable(
  'invitation_view_stats',
  {
    id: primaryId,
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    /** Kalendarski dan u vremenskoj zoni događaja. */
    day: text('day').notNull(),
    views: integer('views').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0),
    shares: integer('shares').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    /*
     * Jedan red po pozivnici i danu.
     * Jedinstvenost je uslov, a ne optimizacija: brojač se uvećava kroz
     * `insert ... on conflict do update`, pa bez ovog indeksa dva istovremena
     * pregleda ne bi mogla bezbedno da se sabiraju.
     */
    uniqueIndex('invitation_view_stats_day_unique').on(
      table.invitationId,
      table.day,
    ),
  ],
);

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  event: one(events, {
    fields: [activityEvents.eventId],
    references: [events.id],
  }),
  actor: one(users, {
    fields: [activityEvents.actorId],
    references: [users.id],
  }),
}));
