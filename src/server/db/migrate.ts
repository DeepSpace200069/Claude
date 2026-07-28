import 'dotenv/config';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Pokretanje migracija.
 *
 * Koristi zasebnu konekciju sa `max: 1` jer migracije moraju da se izvrše
 * serijski, i zatvara je na kraju da proces ne bi ostao živ.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL nije postavljen.');
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log('Pokrećem migracije…');
  await migrate(db, { migrationsFolder: 'src/server/db/migrations' });
  console.log('Migracije su primenjene.');

  await client.end();
}

main().catch((error) => {
  console.error('Migracije nisu uspele:', error);
  process.exit(1);
});
