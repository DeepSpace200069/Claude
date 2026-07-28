import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

/**
 * Konekcija ka bazi.
 *
 * U developmentu se instanca kešira na `globalThis` da hot reload ne otvori
 * novi pool pri svakoj izmeni fajla. Na serverless platformi držimo mali pool
 * jer se svaka instanca funkcije gasi nezavisno.
 */
declare global {
  var __pozivnicaDb: ReturnType<typeof createClient> | undefined;
}

function createClient(connectionString: string) {
  const client = postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 5 : 2,
    idle_timeout: 20,
    connect_timeout: 10,
    // `snake_case` mapiranje radi drizzle preko `casing` opcije.
    prepare: false,
  });

  return drizzle(client, { schema, casing: 'snake_case' });
}

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL nije postavljen. Kopiraj .env.example u .env i pokreni `pnpm db:up`.',
    );
  }
  return url;
}

export const db: ReturnType<typeof createClient> =
  globalThis.__pozivnicaDb ?? createClient(resolveConnectionString());

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pozivnicaDb = db;
}

export type Database = typeof db;
export { schema };
