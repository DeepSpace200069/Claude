import { rm } from 'node:fs/promises';
import path from 'node:path';

import { sql } from './fixtures';
import { ensureHtmlTemplate } from './html-template-setup';

/**
 * Priprema pre pokretanja E2E paketa.
 *
 * Probni HTML šablon se uvozi **pre** nego što se digne server, a ne u samom
 * testu, zbog keša kataloga: spisak šablona se kešira po oznaci koju poništava
 * admin akcija pri objavljivanju. Ovde se objavljuje SQL-om, koji za keš ne
 * zna.
 *
 * Zato se briše i keš podataka. On preživljava i `pnpm build` i restart servera,
 * pa bi bez ovoga prvi zahtev poslužio spisak šablona od pre uvoza - i test bi
 * pao na nečemu što u pravom radu ne može da se desi, jer tamo objavljuje admin
 * panel, koji keš uredno poništi.
 */
export default async function globalSetup(): Promise<void> {
  await ensureHtmlTemplate();
  await sql.end();

  await rm(path.join(process.cwd(), '.next/cache/fetch-cache'), {
    recursive: true,
    force: true,
  });
}
