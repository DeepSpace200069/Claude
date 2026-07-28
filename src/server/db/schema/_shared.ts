import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Zajedničke kolone.
 *
 * `createdAt`/`updatedAt` postoje na svim entitetima (zahtev 20). `updatedAt`
 * ima `$onUpdate` na nivou ORM-a; kritične tabele dodatno imaju trigger u
 * migraciji da bi vrednost bila tačna i kada se piše direktno u SQL-u.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Meko brisanje.
 *
 * Koristi se samo tamo gde je oporavak realna potreba (događaji, pozivnice,
 * gosti) - vidi zahtev 20. Sve ostalo se briše tvrdo, uz `ON DELETE CASCADE`.
 */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const primaryId = uuid('id')
  .primaryKey()
  .default(sql`gen_random_uuid()`);
