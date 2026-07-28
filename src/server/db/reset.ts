import 'dotenv/config';

import { sql } from 'drizzle-orm';

import { db } from './index';

/**
 * Briše sve podatke iz baze, ali zadržava šemu i istoriju migracija.
 *
 * Koristi se pre ponovnog seed-a i u integracionim testovima. `TRUNCATE ...
 * CASCADE` u jednoj naredbi je znatno brži od brisanja tabelu po tabelu i ne
 * zavisi od redosleda stranih ključeva.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await db.execute<{ tablename: string }>(sql`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like '__drizzle%'
  `);

  const names = tables.map((row) => `"public"."${row.tablename}"`);
  if (names.length === 0) return;

  await db.execute(
    sql.raw(`truncate table ${names.join(', ')} restart identity cascade`),
  );
}

/** Direktno pokretanje: `pnpm db:reset`. */
if (process.argv[1]?.endsWith('reset.ts')) {
  resetDatabase()
    .then(() => {
      console.log('Baza je ispražnjena.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Brisanje podataka nije uspelo:', error);
      process.exit(1);
    });
}
