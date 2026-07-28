import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { primaryId, timestamps } from './_shared';
import { events } from './events';
import { guests } from './guests';
import { guestPreferenceKindEnum, tableShapeEnum } from './enums';

/**
 * Raspored sedenja (zahtev 14).
 *
 * Plan sadrži više verzija da bi organizator mogao da sačuva alternative i da
 * se vrati na prethodnu bez gubitka podataka.
 */
export const seatingPlans = pgTable(
  'seating_plans',
  {
    id: primaryId,
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Raspored'),
    activeVersionId: uuid('active_version_id'),
    ...timestamps,
  },
  (table) => [index('seating_plans_event_idx').on(table.eventId)],
);

export const seatingPlanVersions = pgTable(
  'seating_plan_versions',
  {
    id: primaryId,
    planId: uuid('plan_id')
      .notNull()
      .references(() => seatingPlans.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    label: text('label'),
    /** Zaključan raspored se ne menja dok ga organizator ne otključa. */
    isLocked: boolean('is_locked').notNull().default(false),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('seating_plan_versions_unique').on(table.planId, table.version),
  ],
);

/** Sala; jedan događaj može imati više prostorija. */
export const rooms = pgTable(
  'rooms',
  {
    id: primaryId,
    versionId: uuid('version_id')
      .notNull()
      .references(() => seatingPlanVersions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Dimenzije platna u apstraktnim jedinicama (1 jedinica ≈ 10 cm). */
    width: integer('width').notNull().default(1200),
    height: integer('height').notNull().default(800),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (table) => [index('rooms_version_idx').on(table.versionId, table.position)],
);

export const tables = pgTable(
  'tables',
  {
    id: primaryId,
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    shape: tableShapeEnum('shape').notNull().default('round'),
    capacity: integer('capacity').notNull().default(8),

    /** Položaj i veličina na platnu sale. */
    x: integer('x').notNull().default(0),
    y: integer('y').notNull().default(0),
    width: integer('width').notNull().default(120),
    height: integer('height').notNull().default(120),
    rotation: integer('rotation').notNull().default(0),

    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    index('tables_room_idx').on(table.roomId),
    uniqueIndex('tables_room_name_unique').on(table.roomId, table.name),
  ],
);

export const seatAssignments = pgTable(
  'seat_assignments',
  {
    id: primaryId,
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    guestId: uuid('guest_id')
      .notNull()
      .references(() => guests.id, { onDelete: 'cascade' }),
    /** Redni broj mesta za stolom; `null` za zone bez pojedinačnih sedišta. */
    seatNumber: integer('seat_number'),
    ...timestamps,
  },
  (table) => [
    // Gost ne može istovremeno sedeti za dva stola u istoj verziji rasporeda;
    // jedinstvenost po stolu + gostu je prva odbrana, a servis dodatno proverava
    // da gost nije već raspoređen u istoj verziji.
    uniqueIndex('seat_assignments_table_guest_unique').on(
      table.tableId,
      table.guestId,
    ),
    index('seat_assignments_guest_idx').on(table.guestId),
  ],
);

/** Preferencije sedenja - u MVP-u samo prikazuju upozorenja (zahtev 14). */
export const guestPreferences = pgTable(
  'guest_preferences',
  {
    id: primaryId,
    guestId: uuid('guest_id')
      .notNull()
      .references(() => guests.id, { onDelete: 'cascade' }),
    kind: guestPreferenceKindEnum('kind').notNull(),
    /** Za `sit_with` / `avoid`: drugi gost na koga se pravilo odnosi. */
    relatedGuestId: uuid('related_guest_id').references(() => guests.id, {
      onDelete: 'cascade',
    }),
    note: text('note'),
    ...timestamps,
  },
  (table) => [
    index('guest_preferences_guest_idx').on(table.guestId),
    uniqueIndex('guest_preferences_unique').on(
      table.guestId,
      table.kind,
      table.relatedGuestId,
    ),
  ],
);

export const seatingPlansRelations = relations(seatingPlans, ({ one, many }) => ({
  event: one(events, { fields: [seatingPlans.eventId], references: [events.id] }),
  versions: many(seatingPlanVersions),
}));

export const seatingPlanVersionsRelations = relations(
  seatingPlanVersions,
  ({ one, many }) => ({
    plan: one(seatingPlans, {
      fields: [seatingPlanVersions.planId],
      references: [seatingPlans.id],
    }),
    rooms: many(rooms),
  }),
);

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  version: one(seatingPlanVersions, {
    fields: [rooms.versionId],
    references: [seatingPlanVersions.id],
  }),
  tables: many(tables),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  room: one(rooms, { fields: [tables.roomId], references: [rooms.id] }),
  assignments: many(seatAssignments),
}));

export const seatAssignmentsRelations = relations(seatAssignments, ({ one }) => ({
  table: one(tables, { fields: [seatAssignments.tableId], references: [tables.id] }),
  guest: one(guests, { fields: [seatAssignments.guestId], references: [guests.id] }),
}));
