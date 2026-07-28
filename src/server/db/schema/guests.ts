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

import { primaryId, softDelete, timestamps } from './_shared';
import { events } from './events';
import { invitations } from './invitations';
import {
  guestbookStatusEnum,
  rsvpQuestionTypeEnum,
  rsvpStatusEnum,
} from './enums';

/**
 * Domaćinstvo: porodica koja dobija jedan link i odgovara zajedno (zahtev 12).
 */
export const guestHouseholds = pgTable(
  'guest_households',
  {
    id: primaryId,
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Gornja granica broja osoba za personalizovani link (zahtev 13). */
    maxGuests: integer('max_guests'),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [index('guest_households_event_idx').on(table.eventId)],
);

export const guests = pgTable(
  'guests',
  {
    id: primaryId,
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    householdId: uuid('household_id').references(() => guestHouseholds.id, {
      onDelete: 'set null',
    }),

    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    email: text('email'),
    phone: text('phone'),

    isChild: boolean('is_child').notNull().default(false),
    /** Oznake organizatora (`porodica mlade`, `kolege`...). */
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    /** Beleška koju gost nikad ne vidi (zahtev 12). */
    privateNote: text('private_note'),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('guests_event_idx').on(table.eventId),
    index('guests_household_idx').on(table.householdId),
    index('guests_name_idx').on(table.eventId, table.lastName, table.firstName),
  ],
);

/**
 * Personalizovani primalac pozivnice (zahtev 13).
 *
 * Token se čuva isključivo kao heš: baza koja procuri ne sme da omogući
 * otvaranje tuđih personalizovanih linkova.
 */
export const invitationRecipients = pgTable(
  'invitation_recipients',
  {
    id: primaryId,
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    householdId: uuid('household_id').references(() => guestHouseholds.id, {
      onDelete: 'cascade',
    }),
    guestId: uuid('guest_id').references(() => guests.id, {
      onDelete: 'cascade',
    }),

    tokenHash: text('token_hash').notNull(),
    /** Ime u pozdravu („Dragi Marko i Ana”). */
    greetingName: text('greeting_name'),
    maxGuests: integer('max_guests'),
    /** Sadržaj namenjen samo ovoj grupi gostiju. */
    privateNote: text('private_note'),

    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
    openCount: integer('open_count').notNull().default(0),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('invitation_recipients_token_unique').on(table.tokenHash),
    index('invitation_recipients_invitation_idx').on(table.invitationId),
    index('invitation_recipients_household_idx').on(table.householdId),
  ],
);

/** Dodatna pitanja koja organizator sam definiše (zahtev 12). */
export const rsvpQuestions = pgTable(
  'rsvp_questions',
  {
    id: primaryId,
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),

    type: rsvpQuestionTypeEnum('type').notNull(),
    label: text('label').notNull(),
    helpText: text('help_text'),
    isRequired: boolean('is_required').notNull().default(false),
    /** Pitanje se prikazuje samo gostima koji dolaze. */
    attendingOnly: boolean('attending_only').notNull().default(true),
    position: integer('position').notNull().default(0),

    /** Opcije za single/multi choice i granice za broj/datum. */
    config: jsonb('config')
      .$type<{
        options?: Array<{ value: string; label: string }>;
        min?: number;
        max?: number;
        maxLength?: number;
      }>()
      .notNull()
      .default({}),

    ...timestamps,
  },
  (table) => [
    index('rsvp_questions_invitation_idx').on(
      table.invitationId,
      table.position,
    ),
  ],
);

/**
 * Odgovor na pozivnicu.
 *
 * Gost nema nalog, pa je nosilac identiteta ili personalizovani token
 * (`recipientId`) ili slobodan unos imena na javnom RSVP-u.
 */
export const rsvpResponses = pgTable(
  'rsvp_responses',
  {
    id: primaryId,
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id').references(
      () => invitationRecipients.id,
      { onDelete: 'set null' },
    ),
    householdId: uuid('household_id').references(() => guestHouseholds.id, {
      onDelete: 'set null',
    }),

    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),

    status: rsvpStatusEnum('status').notNull().default('pending'),
    adultsCount: integer('adults_count').notNull().default(0),
    childrenCount: integer('children_count').notNull().default(0),
    /** Imena dodatnih gostiju koje gost sam navodi. */
    companions: jsonb('companions').$type<string[]>().notNull().default([]),
    message: text('message'),

    /**
     * Token za kasniju izmenu odgovora (zahtev 5, gost).
     * Čuva se kao heš; gostu se šalje samo u linku.
     */
    editTokenHash: text('edit_token_hash'),

    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastEditedAt: timestamp('last_edited_at', { withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    index('rsvp_responses_invitation_idx').on(
      table.invitationId,
      table.status,
    ),
    // Jedan personalizovani link = jedan odgovor (sprečava dupliranje).
    uniqueIndex('rsvp_responses_recipient_unique').on(table.recipientId),
    uniqueIndex('rsvp_responses_edit_token_unique').on(table.editTokenHash),
  ],
);

export const rsvpAnswers = pgTable(
  'rsvp_answers',
  {
    id: primaryId,
    responseId: uuid('response_id')
      .notNull()
      .references(() => rsvpResponses.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => rsvpQuestions.id, { onDelete: 'cascade' }),
    /** Oblik zavisi od tipa pitanja; validira ga Zod pre upisa. */
    value: jsonb('value').$type<string | number | boolean | string[]>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('rsvp_answers_response_question_unique').on(
      table.responseId,
      table.questionId,
    ),
  ],
);

/** Knjiga želja sa moderacijom (zahtev 9). */
export const guestbookEntries = pgTable(
  'guestbook_entries',
  {
    id: primaryId,
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    message: text('message').notNull(),
    reaction: text('reaction'),
    status: guestbookStatusEnum('status').notNull().default('pending'),
    /** Heš IP adrese - za ograničavanje spama, bez čuvanja same adrese. */
    ipHash: text('ip_hash'),
    ...timestamps,
  },
  (table) => [
    index('guestbook_entries_invitation_idx').on(
      table.invitationId,
      table.status,
    ),
  ],
);

export const guestsRelations = relations(guests, ({ one, many }) => ({
  event: one(events, { fields: [guests.eventId], references: [events.id] }),
  household: one(guestHouseholds, {
    fields: [guests.householdId],
    references: [guestHouseholds.id],
  }),
  recipients: many(invitationRecipients),
}));

export const guestHouseholdsRelations = relations(
  guestHouseholds,
  ({ one, many }) => ({
    event: one(events, {
      fields: [guestHouseholds.eventId],
      references: [events.id],
    }),
    guests: many(guests),
  }),
);

export const rsvpResponsesRelations = relations(
  rsvpResponses,
  ({ one, many }) => ({
    invitation: one(invitations, {
      fields: [rsvpResponses.invitationId],
      references: [invitations.id],
    }),
    recipient: one(invitationRecipients, {
      fields: [rsvpResponses.recipientId],
      references: [invitationRecipients.id],
    }),
    answers: many(rsvpAnswers),
  }),
);

export const rsvpAnswersRelations = relations(rsvpAnswers, ({ one }) => ({
  response: one(rsvpResponses, {
    fields: [rsvpAnswers.responseId],
    references: [rsvpResponses.id],
  }),
  question: one(rsvpQuestions, {
    fields: [rsvpAnswers.questionId],
    references: [rsvpQuestions.id],
  }),
}));
