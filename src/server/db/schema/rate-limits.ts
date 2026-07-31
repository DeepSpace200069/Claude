import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Brojači za ograničavanje učestalosti (zahtev 24 i 8.1).
 *
 * Tabela postoji da bi ograničenje važilo **za celu aplikaciju**, a ne po
 * instanci procesa: sa dva servera iza balansera, brojač u memoriji znači da
 * napadač dobija dvostruko više pokušaja, i to tiho.
 *
 * Ključ je već izveden i neprozirn (`rsvp:<slug>:<otisak>`), gde je otisak heš
 * adrese i klijenta - u tabeli nema nijednog podatka po kom bi se posetilac
 * mogao prepoznati. Redovi se brišu čim prozor istekne.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    /** Trenutak kada prozor ističe i brojač kreće iz početka. */
    resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('rate_limits_reset_idx').on(table.resetAt)],
);
