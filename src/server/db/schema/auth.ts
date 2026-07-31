import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { primaryId, softDelete, timestamps } from './_shared';
import { localeEnum, notificationFrequencyEnum, userRoleEnum } from './enums';

/**
 * Korisnici i Auth.js tabele.
 *
 * Oblik `accounts`, `sessions` i `verificationTokens` prati očekivanja
 * `@auth/drizzle-adapter`; sopstvena polja (uloga, jezik, obaveštenja) dodata
 * su na `users`.
 */
export const users = pgTable(
  'users',
  {
    id: primaryId,
    name: text('name'),
    email: text('email').notNull(),
    emailVerified: timestamp('email_verified', { withTimezone: true }),
    image: text('image'),

    role: userRoleEnum('role').notNull().default('user'),
    locale: localeEnum('locale').notNull().default('sr-Latn'),

    /** Učestalost obaveštenja o RSVP odgovorima (zahtev 28). */
    rsvpNotifications: notificationFrequencyEnum('rsvp_notifications')
      .notNull()
      .default('daily'),
    /** Marketing pristanak je uvek eksplicitan i odvojen (zahtev 25). */
    marketingConsentAt: timestamp('marketing_consent_at', {
      withTimezone: true,
    }),

    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

    /**
     * Kraj poslednjeg poslatog rezimea odgovora.
     *
     * Granica je nužna da rezime ne bi ponovo slao iste odgovore: sledeći
     * obuhvata tačno ono što je stiglo posle ovog trenutka (zahtev 28).
     */
    lastDigestAt: timestamp('last_digest_at', { withTimezone: true }),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    // Email je jedinstven bez obzira na velika/mala slova - korisnici ga kucaju
    // različito pri svakoj prijavi.
    uniqueIndex('users_email_unique').on(sql`lower(${table.email})`),
    index('users_role_idx').on(table.role),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<'oauth' | 'oidc' | 'email' | 'webauthn'>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index('accounts_user_id_idx').on(table.userId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

/**
 * Evidencija saglasnosti (zahtev 25).
 *
 * Čuva se za koga, na šta i kada je pristanak dat, kao i kada je povučen -
 * bez ovoga nije moguće dokazati osnov obrade.
 */
export const consents = pgTable(
  'consents',
  {
    id: primaryId,
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** Za goste koji nemaju nalog vezujemo pristanak za email iz RSVP forme. */
    subjectEmail: text('subject_email'),
    kind: text('kind').notNull().$type<'marketing' | 'cookies' | 'guest_contact'>(),
    granted: boolean('granted').notNull(),
    source: text('source').notNull(),
    ipHash: text('ip_hash'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    index('consents_user_idx').on(table.userId),
    index('consents_subject_email_idx').on(table.subjectEmail),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  consents: many(consents),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
